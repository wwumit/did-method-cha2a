/**
 * cha2a — phone 服务簇（dsh-phone：号码簿 / 积分 / 用量 / 消息中继 / 附件）
 *
 * 定位：phone 服务簇是 cha2a 身份核心的"消费者"——只读 registry 记录做校验与寻址，
 *      从不修改 registry.json（身份核心保持精炼完备，未来可作公共服务）。
 *      对齐 session.js / groups.js 的模块模式：独立数据文件 + deps 注入 + 返回 handled。
 *
 * 依赖注入（deps）：PHONE_RE, DID_RE, send, readBody, requireAdmin,
 *   loadRegistry, trustStatus, levelOf, LEVEL_NAMES   ← 身份核心只读接口
 *
 * 数据：data/phone.json, credits.json, usage.json, messages.json, attachments/
 */
'use strict'

const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

const DATA_DIR = path.join(__dirname, 'data')
const PHONE_FILE = path.join(DATA_DIR, 'phone.json')
const USAGE_FILE = path.join(DATA_DIR, 'usage.json')
const CREDITS_FILE = path.join(DATA_DIR, 'credits.json')
const MESSAGES_FILE = path.join(DATA_DIR, 'messages.json')
const ATTACH_DIR = path.join(DATA_DIR, 'attachments')
const ATTACH_MAX = 10 * 1024 * 1024   // 附件单文件上限 10MB
const MSG_LIMIT = 10000               // 收件箱滚动上限
// 活动：第一批开户送积分（前 N 个送 AMOUNT）
const CREDIT_WELCOME_AMOUNT = parseInt(process.env.CREDIT_WELCOME_AMOUNT || '1000', 10)
const CREDIT_WELCOME_LIMIT = parseInt(process.env.CREDIT_WELCOME_LIMIT || '100', 10)

function readJSON(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) }
  catch { return fallback }
}
function writeJSON(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(data, null, 2))
}
function loadPhone() { return readJSON(PHONE_FILE, { numbers: [] }) }
function savePhone(p) { writeJSON(PHONE_FILE, p) }
function loadUsage() { return readJSON(USAGE_FILE, { byDid: {}, entries: [] }) }
function saveUsage(u) { writeJSON(USAGE_FILE, u) }
function loadCredits() { return readJSON(CREDITS_FILE, { byDid: {}, entries: [], grantedCount: 0 }) }
function saveCredits(c) { writeJSON(CREDITS_FILE, c) }
function loadMessages() { return readJSON(MESSAGES_FILE, { inbox: {}, seq: 0 }) }
function saveMessages(m) { writeJSON(MESSAGES_FILE, m) }

// 导出共享存储层（groups.js 等同一服务簇模块复用：消息中继共用收件箱）
module.exports = { handlePhone, loadPhone, loadMessages, saveMessages, MSG_LIMIT }

async function handlePhone(p, req, res, url, deps) {
  const { PHONE_RE, DID_RE, send, readBody, requireAdmin, loadRegistry, trustStatus, levelOf, LEVEL_NAMES } = deps

  // ── 号码簿（dsh-phone：Agent 电话号码 ↔ DID 映射）──
  // 号码 = did:cha2a:agent 的 E.164 兼容别名；唯一性由 registry 分配保证；
  // 号码只能绑定已注册的 DID（防冒充）；独立 data/phone.json，零影响现有数据。
  if (req.method === 'POST' && p === '/api/v1/phone/register') {
    const denied = requireAdmin(req, res);
    if (denied) return denied;
    const body = await readBody(req);
    const number = String(body.number || '').trim();
    const agentDid = String(body.agentDid || '');
    const displayName = String(body.displayName || '').trim();
    if (!PHONE_RE.test(number)) { send(res, 400, { error: `invalid phone number (E.164 compatible): ${number}` }); return true }
    const m = DID_RE.exec(agentDid);
    if (!m) { send(res, 400, { error: `invalid agent did: ${agentDid}` }); return true }
    if (m[1] !== 'agent') { send(res, 400, { error: 'phone number must bind to a did:cha2a:agent DID' }); return true }
    const reg = loadRegistry();
    if (!reg.records[`${m[1]}/${m[2]}`]) { send(res, 409, { error: `agent not registered: ${agentDid}` }); return true }
    const pb = loadPhone();
    if (pb.numbers.some((n) => n.number === number)) { send(res, 409, { error: `number already assigned: ${number}` }); return true }
    const entry = { number, agentDid, ...(displayName ? { displayName } : {}), status: 'active', created: new Date().toISOString() };
    pb.numbers.push(entry);
    savePhone(pb);
    send(res, 201, { ok: true, entry }); return true
  }

  // 号码 → Agent（来电寻址 + 信任摘要）
  if (req.method === 'GET' && p === '/api/v1/phone/resolve') {
    const number = (url.searchParams.get('number') || '').trim();
    if (!PHONE_RE.test(number)) { send(res, 400, { error: `invalid phone number: ${number}` }); return true }
    const pb = loadPhone();
    const entry = pb.numbers.find((n) => n.number === number);
    if (!entry || entry.status !== 'active') {
      send(res, 200, { number, registered: false, suspicious: true, reason: 'unregistered number' }); return true
    }
    const reg = loadRegistry();
    const m = DID_RE.exec(entry.agentDid);
    const record = m ? reg.records[`${m[1]}/${m[2]}`] : undefined;
    if (!record) { send(res, 200, { number, registered: false, suspicious: true, reason: 'bound DID not found' }); return true }
    const status = trustStatus(record);
    send(res, 200, {
      number, registered: true,
      agentDid: entry.agentDid,
      displayName: entry.displayName || undefined,
      suspicious: !status.active || status.revoked || status.level === 0,
      trust: { level: status.level, levelName: status.levelName, revoked: status.revoked, active: status.active },
    }); return true
  }

  // 号码簿目录（通讯录数据源：列出 active 号码 + 关联 Agent 等级）
  if (req.method === 'GET' && p === '/api/v1/phone/directory') {
    const pb = loadPhone();
    const reg = loadRegistry();
    const list = pb.numbers
      .filter((n) => n.status === 'active')
      .map((n) => {
        const m = DID_RE.exec(n.agentDid);
        const rec = m ? reg.records[`${m[1]}/${m[2]}`] : undefined;
        return { number: n.number, agentDid: n.agentDid, displayName: n.displayName || null, level: rec ? levelOf(rec) : 0, source: n.source || 'admin', created: n.created || null };
      });
    send(res, 200, { count: list.length, numbers: list }); return true
  }

  // 自助开户：申请号码（自动分配号码池 +8695123 0003-0999；每 agent 最多 2 个）
  if (req.method === 'POST' && p === '/api/v1/phone/apply') {
    const body = await readBody(req);
    if (body.consent !== true) { send(res, 400, { error: 'must accept service terms (consent: true)' }); return true }
    const agentDid = String(body.agentDid || '');
    const displayName = String(body.displayName || '').trim();
    const m = DID_RE.exec(agentDid);
    if (!m) { send(res, 400, { error: `invalid agent did: ${agentDid}` }); return true }
    if (m[1] !== 'agent') { send(res, 400, { error: 'apply must bind to a did:cha2a:agent DID' }); return true }
    const reg = loadRegistry();
    if (!reg.records[`${m[1]}/${m[2]}`]) { send(res, 409, { error: `agent not registered: ${agentDid}` }); return true }
    const pb = loadPhone();
    const mine = pb.numbers.filter((n) => n.agentDid === agentDid && n.status === 'active');
    if (mine.length >= 2) { send(res, 409, { error: 'agent already has max 2 numbers' }); return true }
    // 号码池分配：从 +8695123 0003 起取第一个未用号码
    const used = new Set(pb.numbers.map((n) => n.number));
    let number = null;
    for (let i = 3; i <= 999; i++) {
      const cand = `+8695123${String(i).padStart(4, '0')}`;
      if (!used.has(cand)) { number = cand; break; }
    }
    if (!number) { send(res, 503, { error: 'number pool exhausted' }); return true }
    const entry = { number, agentDid, ...(displayName ? { displayName } : {}), status: 'active', source: 'self-apply', created: new Date().toISOString(), consentedAt: new Date().toISOString() };
    pb.numbers.push(entry);
    savePhone(pb);
    // 开户礼：前 N 个开户送积分（一次性，每 agent 一次）
    const cr = loadCredits();
    let welcome = 0;
    if (!cr.byDid[agentDid] && cr.grantedCount < CREDIT_WELCOME_LIMIT) {
      welcome = CREDIT_WELCOME_AMOUNT;
      cr.grantedCount += 1;
      cr.byDid[agentDid] = { balance: welcome, granted: welcome, updatedAt: new Date().toISOString() };
      cr.entries.push({ did: agentDid, type: 'grant', amount: welcome, reason: 'welcome-first-100', at: new Date().toISOString() });
      saveCredits(cr);
    }
    send(res, 201, { ok: true, number, agentDid, displayName: displayName || null, welcomeCredits: welcome, entry }); return true
  }

  // 积分消费（主题解锁等；余额不足 402）
  if (req.method === 'POST' && p === '/api/v1/phone/credits/consume') {
    const body = await readBody(req);
    const did = String(body.did || '');
    const amount = Number(body.amount);
    const reason = String(body.reason || 'consume');
    if (!DID_RE.test(did)) { send(res, 400, { error: `invalid did: ${did}` }); return true }
    if (!Number.isFinite(amount) || amount <= 0) { send(res, 400, { error: 'amount must be > 0' }); return true }
    const cr = loadCredits();
    const a = cr.byDid[did];
    if (!a || a.balance < amount) { send(res, 402, { error: 'insufficient credits', balance: a ? a.balance : 0 }); return true }
    a.balance -= amount;
    a.updatedAt = new Date().toISOString();
    cr.entries.push({ did, type: 'consume', amount, reason, at: new Date().toISOString() });
    saveCredits(cr);
    send(res, 200, { ok: true, did, balance: a.balance, consumed: amount }); return true
  }

  // 积分查询（当前只发放，消费 Phase 2）
  if (req.method === 'GET' && p === '/api/v1/phone/credits') {
    const did = url.searchParams.get('did') || '';
    if (!DID_RE.test(did)) { send(res, 400, { error: `invalid did: ${did}` }); return true }
    const cr = loadCredits();
    const a = cr.byDid[did] || { balance: 0, granted: 0 };
    send(res, 200, { did, credits: a.balance, granted: a.granted, remainingWelcomeSlots: Math.max(0, CREDIT_WELCOME_LIMIT - cr.grantedCount) }); return true
  }

  // 号码停用（管理后台：解绑号码，resolve 不再寻址）
  if (req.method === 'POST' && p === '/api/v1/phone/deactivate') {
    const denied = requireAdmin(req, res);
    if (denied) return denied;
    const body = await readBody(req);
    const number = String(body.number || '').trim();
    if (!PHONE_RE.test(number)) { send(res, 400, { error: `invalid phone number: ${number}` }); return true }
    const pb = loadPhone();
    const entry = pb.numbers.find((n) => n.number === number);
    if (!entry) { send(res, 404, { error: `number not found: ${number}` }); return true }
    entry.status = 'deactivated';
    entry.deactivatedAt = new Date().toISOString();
    savePhone(pb);
    send(res, 200, { ok: true, number, status: 'deactivated' }); return true
  }

  // DID → 号码（对外名片）
  if (req.method === 'GET' && p === '/api/v1/phone/lookup') {
    const did = url.searchParams.get('did') || '';
    const m = DID_RE.exec(did);
    if (!m) { send(res, 400, { error: `invalid did: ${did}` }); return true }
    const pb = loadPhone();
    const list = pb.numbers.filter((n) => n.agentDid === did && n.status === 'active').map((n) => n.number);
    send(res, 200, { did, numbers: list }); return true
  }

  // ── 用量统计（dsh-phone：先统计，计费 Phase 2）──
  const USAGE_TYPES = ['call_seconds', 'sms_sent', 'sms_received', 'attachment_bytes', 'group_msgs', 'calls'];
  if (req.method === 'POST' && p === '/api/v1/phone/usage') {
    const body = await readBody(req);
    const did = String(body.did || '');
    const type = String(body.type || '');
    const amount = Number(body.amount);
    const m = DID_RE.exec(did);
    if (!m) { send(res, 400, { error: `invalid did: ${did}` }); return true }
    if (!USAGE_TYPES.includes(type)) { send(res, 400, { error: `invalid usage type: ${type}` }); return true }
    if (!Number.isFinite(amount) || amount < 0) { send(res, 400, { error: 'amount must be >= 0' }); return true }
    const reg = loadRegistry();
    if (!reg.records[`${m[1]}/${m[2]}`]) { send(res, 409, { error: `agent not registered: ${did}` }); return true }
    const u = loadUsage();
    const agg = u.byDid[did] || { callSeconds: 0, smsSent: 0, smsReceived: 0, attachmentBytes: 0, groupMsgs: 0, calls: 0, updatedAt: null };
    const key = { call_seconds: 'callSeconds', sms_sent: 'smsSent', sms_received: 'smsReceived', attachment_bytes: 'attachmentBytes', group_msgs: 'groupMsgs', calls: 'calls' }[type];
    agg[key] += amount;
    agg.updatedAt = new Date().toISOString();
    u.byDid[did] = agg;
    u.entries.push({ did, type, amount, at: new Date().toISOString(), sessionId: body.sessionId || null });
    if (u.entries.length > 20000) u.entries.splice(0, u.entries.length - 20000);
    saveUsage(u);
    send(res, 201, { ok: true, did, usage: agg }); return true
  }

  if (req.method === 'GET' && p === '/api/v1/phone/usage') {
    const did = url.searchParams.get('did') || '';
    if (!DID_RE.test(did)) { send(res, 400, { error: `invalid did: ${did}` }); return true }
    const u = loadUsage();
    send(res, 200, { did, usage: u.byDid[did] || { callSeconds: 0, smsSent: 0, smsReceived: 0, attachmentBytes: 0, groupMsgs: 0, calls: 0 } }); return true
  }

  if (req.method === 'GET' && p === '/api/v1/phone/usage/entries') {
    const did = url.searchParams.get('did') || '';
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '100', 10) || 100, 500);
    const u = loadUsage();
    let list = u.entries;
    if (did) list = list.filter((e) => e.did === did);
    send(res, 200, { count: list.length, entries: list.slice(-limit).reverse() }); return true
  }

  // ── 消息中继（跨设备短信/附件；寻址复用号码簿；内容服务方可见，E2E 加密为演进）──
  if (req.method === 'POST' && p === '/api/v1/phone/message') {
    const body = await readBody(req);
    const from = String(body.from || '');
    const fromNumber = String(body.fromNumber || '').slice(0, 30);
    const to = String(body.to || '');          // 号码（号码簿寻址）
    const text = String(body.text || '').slice(0, 2000);
    const signal = body.signal;                // WebRTC 信令：{ type: 'offer'|'answer'|'candidate', data }
    const attachment = body.attachment;        // { name, size, hash, fileId }（先传附件拿 fileId）
    if (!PHONE_RE.test(to)) { send(res, 400, { error: `invalid to number: ${to}` }); return true }
    const m = DID_RE.exec(from);
    if (!m) { send(res, 400, { error: `invalid from did: ${from}` }); return true }
    const reg = loadRegistry();
    if (!reg.records[`${m[1]}/${m[2]}`]) { send(res, 409, { error: `from not registered: ${from}` }); return true }
    // 解析 to → 收件 agent DID
    const pb = loadPhone();
    const t = pb.numbers.find((n) => n.number === to && n.status === 'active');
    if (!t) { send(res, 404, { error: `number not in directory: ${to}` }); return true }
    const msgs = loadMessages();
    const id = 'm-' + (++msgs.seq).toString(36);
    const msg = { id, seq: msgs.seq, from, fromNumber: fromNumber || null, to, text: text || null, signal: signal || null, attachment: attachment || null, at: new Date().toISOString() };
    (msgs.inbox[t.agentDid] = msgs.inbox[t.agentDid] || []).push(msg);
    if (msgs.inbox[t.agentDid].length > MSG_LIMIT) msgs.inbox[t.agentDid].splice(0, msgs.inbox[t.agentDid].length - MSG_LIMIT);
    saveMessages(msgs);
    send(res, 201, { ok: true, id, to: t.agentDid }); return true
  }

  if (req.method === 'GET' && p === '/api/v1/phone/messages') {
    const did = url.searchParams.get('did') || '';
    if (!DID_RE.test(did)) { send(res, 400, { error: `invalid did: ${did}` }); return true }
    const since = parseInt(url.searchParams.get('since') || '0', 10) || 0;  // 增量拉取（seq 号）
    const msgs = loadMessages();
    const list = (msgs.inbox[did] || []).filter((x) => x.seq > since);
    // 轮询端点禁用缓存：浏览器 fetch 默认 cache 会命中旧收件箱，导致新信令永远拉不到
    send(res, 200, { did, count: list.length, messages: list }, undefined, { 'Cache-Control': 'no-store' }); return true
  }

  // 附件上传（先传附件拿 fileId，再发消息引用；10MB 上限）
  if (req.method === 'POST' && p === '/api/v1/phone/attachment') {
    const body = await readBody(req);
    const did = String(body.did || '');
    if (!DID_RE.test(did)) { send(res, 400, { error: `invalid did: ${did}` }); return true }
    const reg = loadRegistry();
    const mm = DID_RE.exec(did);
    if (!reg.records[`${mm[1]}/${mm[2]}`]) { send(res, 409, { error: `agent not registered: ${did}` }); return true }
    const name = String(body.name || 'file').slice(0, 200);
    const data = body.data;   // base64 内容
    const mime = String(body.mime || 'application/octet-stream');
    if (!data || typeof data !== 'string') { send(res, 400, { error: 'data (base64) required' }); return true }
    const buf = Buffer.from(data, 'base64');
    if (buf.length > ATTACH_MAX) { send(res, 413, { error: `attachment too large (max ${ATTACH_MAX / 1024 / 1024}MB)` }); return true }
    fs.mkdirSync(ATTACH_DIR, { recursive: true });
    const fileId = crypto.randomBytes(8).toString('hex');
    fs.writeFileSync(path.join(ATTACH_DIR, fileId), buf);
    const hash = crypto.createHash('sha256').update(buf).digest('hex');
    send(res, 201, { ok: true, fileId, name, mime, size: buf.length, hash }); return true
  }

  if (req.method === 'GET' && p.startsWith('/api/v1/phone/attachment/')) {
    const fileId = decodeURIComponent(p.slice('/api/v1/phone/attachment/'.length));
    const file = path.join(ATTACH_DIR, fileId);
    if (!fileId || !/^[0-9a-f]{16}$/.test(fileId) || !fs.existsSync(file)) { send(res, 404, { error: 'attachment not found' }); return true }
    const buf = fs.readFileSync(file);
    res.writeHead(200, {
      'Content-Type': 'application/octet-stream',
      'Content-Length': buf.length,
      'Cache-Control': 'public, max-age=86400',
    });
    return res.end(buf);
  }


  return null   // 未匹配 → 交给 server.js 继续
}
