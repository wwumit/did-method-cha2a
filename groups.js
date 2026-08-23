/**
 * dsh-phone 群聊模块（RCS 团队协作空间；逻辑独立，对齐 session.js 模式）
 *
 * 职责：群管理（创建/成员/查询）+ 群消息广播（复用 message 中继）
 *  - 群 = 团队协作空间：成员是号码列表（人=phone 号，agent=自己号），resolve 定角色
 *  - 群消息进成员收件箱（复用 messages 端点拉取，带 groupId 区分）
 *  - 属于 phone 服务簇，不碰 cha2a 身份/证据核心
 *
 * 数据：data/groups.json
 */
'use strict'

const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

const DATA_DIR = path.join(__dirname, 'data')
const GROUPS_FILE = path.join(DATA_DIR, 'groups.json')
const GROUP_NAME_MAX = 60
const GROUP_MEMBERS_MAX = 100

function readJSON(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) }
  catch { return fallback }
}
function writeJSON(file, data) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  fs.writeFileSync(file, JSON.stringify(data, null, 1))
}
function loadGroups() { return readJSON(GROUPS_FILE, { groups: {} }) }
function saveGroups(g) { writeJSON(GROUPS_FILE, g) }

/** 规范化号码（去空格，E.164） */
function normNumber(n) { return String(n || '').replace(/[^0-9+]/g, '') }

/**
 * 群聊端点处理器。
 * @param {object} deps { PHONE_RE, DID_RE, send, readBody, requireAdmin, loadRegistry, loadPhone, loadMessages, saveMessages, MSG_LIMIT }
 * @returns {boolean|null} 已处理 true，未匹配 null
 */
async function handleGroup(p, req, res, url, deps) {
  const { PHONE_RE, DID_RE, send, readBody, requireAdmin, loadRegistry, loadPhone, loadMessages, saveMessages, MSG_LIMIT, levelOf } = deps

  // ── 创建群（人 或 agent 都能建）──
  if (req.method === 'POST' && p === '/api/v1/phone/group') {
    const body = await readBody(req)
    const name = String(body.name || '').slice(0, GROUP_NAME_MAX)
    const creator = String(body.creator || '')            // 建群人（号码）或 agent DID
    const members = Array.isArray(body.members) ? body.members.map((m) => String(m).slice(0, 60)).slice(0, GROUP_MEMBERS_MAX) : []
    if (!name) { send(res, 400, { error: 'group name required' }); return true }
    if (!members.length) { send(res, 400, { error: 'members required' }); return true }
    // 校验 creator 身份（号码在号码簿 或 agent 已注册）
    const reg = loadRegistry()
    const pb = loadPhone()
    const isAgent = DID_RE.test(creator)
    const isNumber = PHONE_RE.test(creator) && pb.numbers.some((n) => n.number === creator && n.status === 'active')
    if (!isAgent && !isNumber) { send(res, 400, { error: `invalid creator: ${creator}` }); return true }
    if (isAgent) {
      const m = DID_RE.exec(creator)
      if (!reg.records[`${m[1]}/${m[2]}`]) { send(res, 409, { error: `agent not registered: ${creator}` }); return true }
    }
    // 成员规范化：号码去空格；agent DID 校验注册
    const normMembers = []
    for (const mem of members) {
      if (DID_RE.test(mem)) {
        const m = DID_RE.exec(mem)
        if (!reg.records[`${m[1]}/${m[2]}`]) { send(res, 409, { error: `member agent not registered: ${mem}` }); return true }
        normMembers.push(mem)
      } else {
        const n = normNumber(mem)
        if (!PHONE_RE.test(n)) { send(res, 400, { error: `invalid member: ${mem}` }); return true }
        const exists = pb.numbers.some((x) => x.number === n && x.status === 'active')
        if (!exists) { send(res, 409, { error: `member number not in directory: ${n}` }); return true }
        normMembers.push(n)
      }
    }
    const g = loadGroups()
    const id = 'grp_' + crypto.randomBytes(4).toString('hex')
    // 群级会话 id（RCS 持续会话语义）：agent 多轮协同按 conversationId 关联
    const conversationId = 'grpconv_' + crypto.randomBytes(4).toString('hex')
    g.groups[id] = {
      name,
      members: normMembers,
      createdBy: creator,
      createdAt: new Date().toISOString(),
      conversationId,
    }
    saveGroups(g)
    send(res, 201, { ok: true, groupId: id, conversationId, name, members: normMembers })
    return true
  }

  // ── 群列表（我加入的群；参数 did=号码或agentDID）──
  if (req.method === 'GET' && p === '/api/v1/phone/group/list') {
    const did = url.searchParams.get('did') || ''
    if (!did) { send(res, 400, { error: 'provide ?did=' }); return true }
    const g = loadGroups()
    const mine = Object.entries(g.groups)
      .filter(([, grp]) => grp.members.includes(did) || grp.createdBy === did)
      .map(([id, grp]) => ({ groupId: id, name: grp.name, memberCount: grp.members.length, createdAt: grp.createdAt }))
    send(res, 200, { ok: true, count: mine.length, groups: mine })
    return true
  }

  // ── 群成员详情（昵称/类型/等级 聚合；昵称解析只读 registry metadata + 号码簿 displayName）──
  if (req.method === 'GET' && /^\/api\/v1\/phone\/group\/[^/]+\/members-detail$/.test(p)) {
    const groupId = p.split('/')[5]
    if (!/^grp_[0-9a-f]+$/.test(groupId)) { send(res, 400, { error: `invalid groupId: ${groupId}` }); return true }
    const g = loadGroups()
    const grp = g.groups[groupId]
    if (!grp) { send(res, 404, { error: `group not found: ${groupId}` }); return true }
    const reg = loadRegistry()
    const pb = loadPhone()
    const members = (grp.members || []).map((m) => {
      let nickname = null, type = 'phone', level = 0
      if (DID_RE.test(m)) {
        // agent 成员：昵称 = registry metadata name/author；类型 agent；等级 levelOf
        const mm = DID_RE.exec(m)
        const rec = reg.records[`${mm[1]}/${mm[2]}`]
        const meta = (rec && rec.metadata) || {}
        type = 'agent'
        level = rec ? levelOf(rec) : 0
        nickname = meta.name || meta.author || m.split(':').pop()
      } else {
        // 号码成员：昵称 = phone.json displayName；回退短号；等级 = 关联 agent 的 level
        const n = normNumber(m)
        const t = pb.numbers.find((x) => x.number === n && x.status === 'active')
        nickname = (t && t.displayName) || n.slice(-4)
        if (t) {
          const am = DID_RE.exec(t.agentDid)
          const rec = am ? reg.records[`${am[1]}/${am[2]}`] : undefined
          level = rec ? levelOf(rec) : 0
        }
      }
      return { member: m, nickname, type, level }
    })
    send(res, 200, { ok: true, groupId, count: members.length, members })
    return true
  }

  // ── 群详情（成员列表）──
  if (req.method === 'GET' && p.startsWith('/api/v1/phone/group/')) {
    const rest = p.slice('/api/v1/phone/group/'.length)
    if (rest === 'list') return null   // 上面已处理
    const groupId = rest.split('/')[0]
    if (!/^grp_[0-9a-f]+$/.test(groupId)) { send(res, 400, { error: `invalid groupId: ${groupId}` }); return true }
    const g = loadGroups()
    const grp = g.groups[groupId]
    if (!grp) { send(res, 404, { error: `group not found: ${groupId}` }); return true }
    send(res, 200, { ok: true, groupId, name: grp.name, members: grp.members, createdBy: grp.createdBy, createdAt: grp.createdAt, ...(grp.conversationId ? { conversationId: grp.conversationId } : {}) })
    return true
  }

  // ── 加成员（管理操作）──
  if (req.method === 'POST' && p === '/api/v1/phone/group/member') {
    const denied = requireAdmin(req, res)
    if (denied) return true
    const body = await readBody(req)
    const groupId = String(body.groupId || '')
    const member = String(body.member || '')
    const g = loadGroups()
    const grp = g.groups[groupId]
    if (!grp) { send(res, 404, { error: `group not found: ${groupId}` }); return true }
    if (!grp.members.includes(member)) {
      if (grp.members.length >= GROUP_MEMBERS_MAX) { send(res, 409, { error: 'group member limit' }); return true }
      grp.members.push(member)
      saveGroups(g)
    }
    send(res, 200, { ok: true, groupId, members: grp.members })
    return true
  }

  // ── 移除成员（管理操作）──
  if (req.method === 'DELETE' && p === '/api/v1/phone/group/member') {
    const denied = requireAdmin(req, res)
    if (denied) return true
    const groupId = url.searchParams.get('groupId') || ''
    const member = url.searchParams.get('member') || ''
    const g = loadGroups()
    const grp = g.groups[groupId]
    if (!grp) { send(res, 404, { error: `group not found: ${groupId}` }); return true }
    grp.members = grp.members.filter((x) => x !== member)
    saveGroups(g)
    send(res, 200, { ok: true, groupId, members: grp.members })
    return true
  }

  // ── 群消息广播（复用 message 中继：广播给每个成员号码）──
  if (req.method === 'POST' && p === '/api/v1/phone/group/message') {
    const body = await readBody(req)
    const from = String(body.from || '')
    const fromNumber = String(body.fromNumber || '').slice(0, 30)
    const groupId = String(body.groupId || '')
    const text = String(body.text || '').slice(0, 2000)
    const m = DID_RE.exec(from)
    if (!m) { send(res, 400, { error: `invalid from did: ${from}` }); return true }
    const reg = loadRegistry()
    if (!reg.records[`${m[1]}/${m[2]}`]) { send(res, 409, { error: `from not registered: ${from}` }); return true }
    const g = loadGroups()
    const grp = g.groups[groupId]
    if (!grp) { send(res, 404, { error: `group not found: ${groupId}` }); return true }
    const pb = loadPhone()
    const msgs = loadMessages()
    // 广播给每个成员号码（agent DID 成员：resolve 到其号码/收件箱）
    const delivered = []
    for (const member of grp.members) {
      let targetDid = null
      if (DID_RE.test(member)) {
        // agent DID 成员 → 直接投递 agent 收件箱
        const mm = DID_RE.exec(member)
        if (reg.records[`${mm[1]}/${mm[2]}`]) targetDid = member
      } else {
        // 号码成员 → 号码簿找 agentDID
        const n = normNumber(member)
        const t = pb.numbers.find((x) => x.number === n && x.status === 'active')
        if (t) targetDid = t.agentDid
      }
      if (!targetDid) continue
      const id = 'm-' + (++msgs.seq).toString(36)
      const msg = { id, seq: msgs.seq, from, fromNumber: fromNumber || null, to: member, groupId, ...(grp.conversationId ? { conversationId: grp.conversationId } : {}), text: text || null, signal: null, attachment: null, at: new Date().toISOString() }
      ;(msgs.inbox[targetDid] = msgs.inbox[targetDid] || []).push(msg)
      if (msgs.inbox[targetDid].length > MSG_LIMIT) msgs.inbox[targetDid].splice(0, msgs.inbox[targetDid].length - MSG_LIMIT)
      delivered.push({ member, to: targetDid, id })
    }
    saveMessages(msgs)
    if (!delivered.length) { send(res, 200, { ok: true, groupId, delivered: 0, note: 'no deliverable members' }); return true }
    send(res, 201, { ok: true, groupId, delivered: delivered.length, to: delivered })
    return true
  }

  return null   // 未匹配群聊端点
}

module.exports = { handleGroup }
