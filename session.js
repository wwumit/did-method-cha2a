/**
 * dsh-phone session 管理模块（逻辑独立——从 server.js 拆出）
 *
 * 职责：agent ↔ 会话绑定（运行时寻址）+ 会话凭证（身份与凭证分离）
 *  - 身份（did:cha2a:agent:*）仍在 registry 主服务，本模块只做"运行时绑定/凭证"
 *  - 高频心跳写 bindings，不影响 registry 身份文件
 *  - 凭证（session-token）：短命签发，解决 Secret Zero（签发校验 + issuedBy 白名单 + 速率限制）
 *
 * 数据：
 *  - session-bindings.json  绑定（agentDid → [{sessionId, primary, ...}]）
 *  - session-tokens.json    凭证（tok_xxx → {agentDid, issuedBy, expiresAt, ...}）
 *
 * 兼容：无 token 的登记（tokenless）仍允许（过渡期），返回 deprecation 提示。
 */
'use strict'

const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

const DATA_DIR = path.join(__dirname, 'data')
const BINDINGS_FILE = path.join(DATA_DIR, 'session-bindings.json')
const TOKENS_FILE = path.join(DATA_DIR, 'session-tokens.json')

const DEFAULT_TTL = 3600                 // 凭证/绑定默认 1h（对齐 SVID）
const TOKEN_TTL_MIN = 60
const TOKEN_TTL_MAX = 86400
const RATE_LIMIT = { windowMs: 60 * 1000, max: 10 }   // 每 agent 每分钟最多签发 10 次

function readJSON(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) }
  catch { return fallback }
}
function writeJSON(file, data) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  fs.writeFileSync(file, JSON.stringify(data, null, 1))
}

function loadBindings() { return readJSON(BINDINGS_FILE, { bindings: {} }) }
function saveBindings(b) { writeJSON(BINDINGS_FILE, b) }
function loadTokens() { return readJSON(TOKENS_FILE, { tokens: {}, issuedByAllowlist: ['dsh-phone', 'dsh-agent-message'], rateLog: {} }) }
function saveTokens(t) { writeJSON(TOKENS_FILE, t) }

/** 清理过期 token + 过期绑定（主动清理，可被定时任务调用） */
function cleanup(tokens, bindings) {
  const now = Date.now()
  let cleaned = { tokens: 0, bindings: 0 }
  for (const k of Object.keys(tokens.tokens)) {
    if (Date.parse(tokens.tokens[k].expiresAt) <= now) { delete tokens.tokens[k]; cleaned.tokens++ }
  }
  for (const did of Object.keys(bindings.bindings)) {
    const before = bindings.bindings[did].length
    bindings.bindings[did] = bindings.bindings[did].filter((x) => Date.parse(x.boundUntil) > now)
    cleaned.bindings += before - bindings.bindings[did].length
    if (!bindings.bindings[did].length) delete bindings.bindings[did]
  }
  return cleaned
}

/** 校验 agentDid 已注册（用传入的 registry 加载函数） */
function agentRegistered(loadRegistry, agentDid, DID_RE) {
  if (!DID_RE.test(agentDid)) return { ok: false, code: 400, error: `invalid agentDid: ${agentDid}` }
  const reg = loadRegistry()
  const m = DID_RE.exec(agentDid)
  if (!reg.records[`${m[1]}/${m[2]}`]) return { ok: false, code: 409, error: `agent not registered: ${agentDid}` }
  return { ok: true }
}

/**
 * session 端点处理器。
 * @param {object} deps  { loadRegistry, DID_RE, send, readBody, requireAdmin }
 * @returns {boolean|null} 已处理返回 true（已 send），未匹配返回 null（让 server.js 继续）
 */
async function handleSession(p, req, res, url, deps) {
  const { loadRegistry, DID_RE, send, readBody, requireAdmin } = deps

  // ── 凭证签发（身份与凭证分离：agent 先拿短命 token）──
  if (req.method === 'POST' && p === '/api/v1/agent/session-token') {
    const body = await readBody(req)
    const agentDid = String(body.agentDid || '')
    const issuedBy = String(body.issuedBy || '').slice(0, 50)
    const ttl = Math.min(Math.max(parseInt(body.ttlSeconds || String(DEFAULT_TTL), 10) || DEFAULT_TTL, TOKEN_TTL_MIN), TOKEN_TTL_MAX)

    const chk = agentRegistered(loadRegistry, agentDid, DID_RE)
    if (!chk.ok) { send(res, chk.code, { error: chk.error }); return true }

    const tokens = loadTokens()
    // issuedBy 白名单（Secret Zero 缓解：只有已知登记方能代 agent 要凭证）
    if (!tokens.issuedByAllowlist.includes(issuedBy)) {
      send(res, 403, { error: `issuedBy not allowed: ${issuedBy}`, allowed: tokens.issuedByAllowlist });
      return true
    }
    // 速率限制（防刷签发）
    const now = Date.now()
    const rl = tokens.rateLog[agentDid] || { count: 0, windowStart: now }
    if (now - rl.windowStart >= RATE_LIMIT.windowMs) { rl.count = 0; rl.windowStart = now }
    rl.count++
    tokens.rateLog[agentDid] = rl
    if (rl.count > RATE_LIMIT.max) {
      send(res, 429, { error: 'rate limit exceeded', retryAfterSeconds: Math.ceil((rl.windowStart + RATE_LIMIT.windowMs - now) / 1000) });
      return true
    }
    // 清理过期 token（顺带）
    cleanup(tokens, loadBindings())
    const token = 'tok_' + crypto.randomBytes(16).toString('hex')
    tokens.tokens[token] = {
      agentDid,
      issuedBy,
      capabilities: Array.isArray(body.capabilities) ? body.capabilities.map((c) => String(c).slice(0, 50)) : [],
      issuedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + ttl * 1000).toISOString(),
    }
    saveTokens(tokens)
    send(res, 201, { ok: true, token, agentDid, expiresAt: tokens.tokens[token].expiresAt });
    return true
  }

  // ── 登记绑定（凭证驱动；tokenless 过渡兼容）──
  if (req.method === 'POST' && p === '/api/v1/agent/session-bind') {
    const body = await readBody(req)
    const sessionId = String(body.sessionId || '').slice(0, 200)
    if (!sessionId) { send(res, 400, { error: 'sessionId is required' }); return true }

    let agentDid = String(body.agentDid || '')
    let tokenRef = null
    let tokenless = false

    // 优先用 token 解出 agentDid（凭证驱动）；无 token 则用 agentDid（过渡）
    if (body.token) {
      const tokens = loadTokens()
      const tk = tokens.tokens[String(body.token)]
      if (!tk || Date.parse(tk.expiresAt) <= Date.now()) {
        send(res, 401, { error: 'invalid or expired token' });
        return true
      }
      agentDid = tk.agentDid
      tokenRef = String(body.token)
    } else {
      tokenless = true
    }

    const chk = agentRegistered(loadRegistry, agentDid, DID_RE)
    if (!chk.ok) { send(res, chk.code, { error: chk.error }); return true }

    const ttl = Math.min(Math.max(parseInt(body.ttlSeconds || String(DEFAULT_TTL), 10) || DEFAULT_TTL, TOKEN_TTL_MIN), TOKEN_TTL_MAX)
    const b = loadBindings()
    const now = Date.now()
    const list = b.bindings[agentDid] || []
    const alive = list.filter((x) => Date.parse(x.boundUntil) > now)
    const idx = alive.findIndex((x) => x.sessionId === sessionId)
    const entry = {
      sessionId,
      primary: idx === -1 ? true : alive[idx].primary,
      scope: String(body.scope || 'dsh-session').slice(0, 50),
      tier: String(body.tier || 'basic').slice(0, 20),
      authProtocol: String(body.authProtocol || 'did-sig').slice(0, 20),
      registeredBy: String(body.registeredBy || 'self').slice(0, 50),
      ...(tokenRef ? { tokenRef } : {}),
      boundAt: new Date(now).toISOString(),
      boundUntil: new Date(now + ttl * 1000).toISOString(),
    }
    if (idx === -1) {
      alive.forEach((x) => { x.primary = false })
      alive.push(entry)
    } else {
      alive[idx] = entry
    }
    b.bindings[agentDid] = alive
    saveBindings(b)
    send(res, 201, {
      ok: true, agentDid, sessionId, primary: entry.primary, boundUntil: entry.boundUntil,
      ...(tokenless ? { warning: 'tokenless registration deprecated; use session-token + token' } : {}),
    });
    return true
  }

  // ── 查询绑定（公开读；支持 did 或 token）──
  if (req.method === 'GET' && p === '/api/v1/agent/locate') {
    const did = url.searchParams.get('did') || ''
    const token = url.searchParams.get('token') || ''
    let agentDid = did
    if (!agentDid && token) {
      const tokens = loadTokens()
      const tk = tokens.tokens[token]
      if (tk && Date.parse(tk.expiresAt) > Date.now()) agentDid = tk.agentDid
    }
    if (!agentDid) { send(res, 400, { error: 'provide ?did= or ?token=' }); return true }
    const chk = agentRegistered(loadRegistry, agentDid, DID_RE)
    if (!chk.ok) { send(res, 200, { ok: true, bound: false, agentDid, reason: 'agent not registered' }); return true }
    const b = loadBindings()
    const now = Date.now()
    const alive = (b.bindings[agentDid] || []).filter((x) => Date.parse(x.boundUntil) > now)
    if (!alive.length) { send(res, 200, { ok: true, bound: false, agentDid, reason: 'not-bound' }); return true }
    const primary = alive.find((x) => x.primary) || alive[0]
    send(res, 200, {
      ok: true, bound: true, agentDid,
      sessionId: primary.sessionId, scope: primary.scope, tier: primary.tier,
      authProtocol: primary.authProtocol, boundAt: primary.boundAt, boundUntil: primary.boundUntil,
      alternatives: alive.filter((x) => x.sessionId !== primary.sessionId).map((x) => ({ sessionId: x.sessionId, boundUntil: x.boundUntil })),
    });
    return true
  }

  // ── 解绑（管理操作，X-Admin-Key）──
  if (req.method === 'DELETE' && p === '/api/v1/agent/session-bind') {
    const denied = requireAdmin(req, res)
    if (denied) return denied
    const agentDid = url.searchParams.get('did') || ''
    const sessionId = url.searchParams.get('sessionId') || ''
    if (!DID_RE.test(agentDid)) { send(res, 400, { error: `invalid did: ${agentDid}` }); return true }
    const b = loadBindings()
    if (!sessionId) { delete b.bindings[agentDid] }
    else {
      const list = (b.bindings[agentDid] || []).filter((x) => x.sessionId !== sessionId)
      if (list.length) b.bindings[agentDid] = list; else delete b.bindings[agentDid]
    }
    saveBindings(b)
    send(res, 200, { ok: true, agentDid });
    return true
  }

  // ── 主动清理（管理操作）──
  if (req.method === 'POST' && p === '/api/v1/agent/session-cleanup') {
    const denied = requireAdmin(req, res)
    if (denied) return denied
    const tokens = loadTokens()
    const bindings = loadBindings()
    const cleaned = cleanup(tokens, bindings)
    saveTokens(tokens)
    saveBindings(bindings)
    send(res, 200, { ok: true, cleaned });
    return true
  }

  return null   // 未匹配 session 端点
}

module.exports = { handleSession }
