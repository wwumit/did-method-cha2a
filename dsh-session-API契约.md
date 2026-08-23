# dsh-session 服务 API 契约（v1）

> 日期：2026-08-21
> 定位：session 管理服务的接口契约——**逻辑独立的正名**。现在内部是模块函数（session.js），将来物理拆服务时，本契约就是跨进程 HTTP API，语义不变。
> 对应：cha2a-session服务独立分析.md、cha2a-session优化方案.md
> 原则：身份（registry）与凭证（session 服务）分离；接口契约先行，实现可演进
> 状态：v1 契约（本地认知，未公开）

---

## 0. 服务定位与边界

```
dsh-session 服务 = agent 运行时寻址（绑定/凭证/定位）
  - 身份真相（did:cha2a:agent:*）在 registry，session 服务只"借用校验"，不拥有
  - 高频心跳写 bindings，低频注册留 registry
  - 凭证（session-token）短命，签发校验 + 白名单 + 速率限制
```

**接口设计原则**：
1. **路径即契约**：`/api/v1/agent/*` 前缀，将来物理拆服务时路径不变，只换 host
2. **身份引用**：所有写操作可用 `token`（凭证）或 `agentDid`（过渡）；查询支持 did/token 双模式
3. **错误码**：401 无效凭证 / 403 白名单外 / 409 未注册 / 429 速率 / 400 参数

---

## 1. 凭证签发 `POST /api/v1/agent/session-token`

**语义**：agent（或代理插件）请求短命会话凭证，用于后续登记绑定/路由。

**请求**：
```json
{
  "agentDid": "did:cha2a:agent:dshlib",     // 必填，须已注册
  "issuedBy": "dsh-phone",                  // 必填，须在白名单
  "ttlSeconds": 3600,                       // 可选，默认 3600，范围 60-86400
  "capabilities": ["sms", "voice"]          // 可选，能力声明
}
```

**响应**：
```json
201 { "ok": true, "token": "tok_xxx", "agentDid": "...", "expiresAt": "ISO" }
403 { "error": "issuedBy not allowed: ...", "allowed": ["dsh-phone", ...] }
409 { "error": "agent not registered: ..." }
429 { "error": "rate limit exceeded", "retryAfterSeconds": N }
```

**校验链**：agentDid 注册 → issuedBy 白名单 → 速率限制（10/min/agent）。

## 2. 登记绑定 `POST /api/v1/agent/session-bind`

**语义**：agent 声明"我当前运行在会话 X"（TTL 心跳）。

**请求**（二选一）：
```json
{ "token": "tok_xxx", "sessionId": "session-xxx", "ttlSeconds": 3600, ... }   // 凭证驱动（推荐）
{ "agentDid": "...", "sessionId": "...", "ttlSeconds": 3600, ... }           // tokenless（过渡，deprecated）
```

**响应**：
```json
201 { "ok": true, "agentDid": "...", "sessionId": "...", "primary": true, "boundUntil": "ISO",
      "warning": "tokenless registration deprecated..." }   // 仅 tokenless 时含 warning
401 { "error": "invalid or expired token" }
409 { "error": "agent not registered: ..." }
```

**语义细节**：
- 同 sessionId 刷新（保持 primary）；新 sessionId 压入标主，旧的降备选
- 过期项写入时惰性清理

## 3. 查询定位 `GET /api/v1/agent/locate`

**语义**：查 agent 当前绑定的会话（公开读）。

**参数**：`?did=` 或 `?token=`（二选一，token 优先解出 agentDid）。

**响应**：
```json
200 { "ok": true, "bound": true, "agentDid": "...", "sessionId": "...",
      "scope": "dsh-session", "tier": "basic", "authProtocol": "did-sig",
      "boundAt": "ISO", "boundUntil": "ISO", "alternatives": [...] }
200 { "ok": true, "bound": false, "agentDid": "...", "reason": "not-bound" }
200 { "ok": true, "bound": false, "agentDid": "...", "reason": "agent not registered" }
400 { "error": "provide ?did= or ?token=" }
```

## 4. 解绑 `DELETE /api/v1/agent/session-bind`

**语义**：agent 会话关闭/卸载（管理操作，幂等）。

**鉴权**：X-Admin-Key（管理写操作）。

**参数**：`?did=`（必填）+ `?sessionId=`（可选，缺省全解绑）。

**响应**：`200 { "ok": true, "agentDid": "..." }`

## 5. 主动清理 `POST /api/v1/agent/session-cleanup`

**语义**：清理过期 token + 过期绑定（管理操作，可定时调用）。

**鉴权**：X-Admin-Key。

**响应**：`200 { "ok": true, "cleaned": { "tokens": N, "bindings": N } }`

---

## 6. 数据模型（契约的一部分）

### session-bindings.json
```json
{ "bindings": {
    "did:cha2a:agent:xxx": [{
      "sessionId": "session-xxx",
      "primary": true,
      "scope": "dsh-session",       // 预留 dsh-host（跨实例）
      "tier": "basic",              // 预留业务分级
      "authProtocol": "did-sig",    // 预留 oauth2.1/didcomm
      "registeredBy": "dsh-phone",
      "tokenRef": "tok_xxx",        // 可选：凭证关联
      "boundAt": "ISO", "boundUntil": "ISO"
    }]
}}
```

### session-tokens.json
```json
{ "tokens": {
    "tok_xxx": { "agentDid": "...", "issuedBy": "...", "capabilities": [...],
                 "issuedAt": "ISO", "expiresAt": "ISO" } },
  "issuedByAllowlist": ["dsh-phone", "dsh-agent-message"],
  "rateLog": { "agentDid": { "count": N, "windowStart": ts } }
}
```

---

## 7. 物理拆分的契约不变性

**将来物理拆服务时**：
- 同一套路径 `/api/v1/agent/*`，从"registry 内模块"变成"独立 session 服务 host"
- 唯一变化：agent 校验从"本地 loadRegistry"改为"调 registry 公开 API（resolve/did）"
- 调用方（dsh-phone）**零改动**——只改配置里的 session 服务地址

这就是"逻辑独立"的价值：**接口契约先行，实现从模块演进到服务，调用方无感**。

---

## 8. 版本与演进

| 版本 | 变更 |
|---|---|
| v1（当前）| 逻辑独立 + 凭证层（本契约）|
| v2（将来）| 物理拆服务 + 凭证签名（X-DID-Sig）+ 跨实例 scope |
| v3（远期）| 多实例就近部署 + 凭证与证据关联（证据化寻址）|
