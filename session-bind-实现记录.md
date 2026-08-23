# session-bind 实现记录与回退方案

> 日期：2026-08-21
> 状态：已实现并部署（生产验证通过）· **未开源、未上传 GitHub**（本地认知，测试通过后再定公开范围）
> 对应设计：dsh-phone-session-bind设计.md（定稿 v1）+ 智能体互联网·CHA2A 设计.md（§三/§9.6）

---

## 一、实现内容

### 1. registry 新端点（server.js）

| 端点 | 方法 | 鉴权 | 说明 |
|---|---|---|---|
| `/api/v1/agent/session-bind` | POST | X-Admin-Key | agent 会话登记（TTL 心跳）；同 sessionId 刷新，新 sessionId 压入标主 |
| `/api/v1/agent/locate` | GET | 公开读 | 查询 agent 当前绑定会话（含 alternatives 备选列表）|
| `/api/v1/agent/session-bind` | DELETE | X-Admin-Key | 解绑（单会话 or 全解绑，幂等）|

### 2. 数据模型（data/session-bindings.json，独立于 registry.json）

```json
{
  "bindings": {
    "did:cha2a:agent:dshlib": [{
      "sessionId": "session-xxx",
      "primary": true,
      "scope": "dsh-session",      // 可选项：预留 dsh-host / 跨机器
      "tier": "basic",             // 可选项：预留业务分级
      "authProtocol": "did-sig",   // 可选项：预留 oauth2.1 / didcomm
      "registeredBy": "dsh-phone", // 谁登记的（审计）
      "boundAt": "...", "boundUntil": "..."
    }]
  }
}
```

### 3. 顺带修复：requireAdmin 返回值 bug

- 原实现失败时 `return send(...)`（返回 undefined）→ 调用方 `if (denied) return denied` 不短路 → 双重 send → **ERR_HTTP_HEADERS_SENT 崩溃**
- 修复：失败时 `{ send(...); return true; }`，成功返回 null——所有写端点受益（含原有 deactivate 等）

### 4. nginx 新增 location

`/api/v1/agent/` → 127.0.0.1:8787（照 phone 端点模式）

---

## 二、测试结果（生产验证）

| 用例 | 结果 |
|---|---|
| 无鉴权登记 | 401（服务不崩）✅ |
| 正常登记 → locate | bound + sessionId + boundUntil ✅ |
| 覆盖：新会话 | 新主 + 旧进 alternatives ✅ |
| 同会话刷新 | 保持 primary ✅ |
| 未注册 agent locate | not registered ✅ |
| 解绑单个/全部 | 正确 + 幂等 ✅ |
| TTL 过期 | boundUntil 后 locate → not-bound ✅ |
| 原有服务 | registry/directory/store 全 200 ✅ |
| 数据隔离 | 测试用临时目录，真实 data 零污染 ✅ |

测试过程发现并修复：requireAdmin bug（见上）、nginx 缺 location（404）、服务器时钟核对（TTL 验证时序）。

---

## 三、回退方案

### 备份位置
- `server.js`：`/opt/cha2a-registry/backups/server.js.pre-session-bind-<时间戳>/`
- nginx：`/etc/nginx/sites-enabled/compliancehub.cn.bak-session-bind-<时间戳>`

### 回退步骤
1. **回退 server.js**：
   ```bash
   sudo cp /opt/cha2a-registry/backups/server.js.pre-session-bind-* /opt/cha2a-registry/server.js
   sudo systemctl restart cha2a.service
   ```
2. **回退 nginx**（去掉 agent location）：
   ```bash
   sudo cp /etc/nginx/sites-enabled/compliancehub.cn.bak-session-bind-* /etc/nginx/sites-enabled/compliancehub.cn
   sudo nginx -t && sudo systemctl reload nginx
   ```
3. **删数据文件**（若需彻底移除绑定数据）：
   ```bash
   rm /opt/cha2a-registry/data/session-bindings.json
   ```
4. **验证回退**：registry/directory/store 200；`/api/v1/agent/locate` 应 404（location 已撤）。

---

## 四、公开范围（待定，尽量少公开）

**当前：全部本地/内部，未上传 GitHub、未发帖。**
实现涉及：registry server.js（改）+ nginx（改）+ 设计文档（本地）。

**待测试更充分后评估公开哪些**：
- 设计文档（session-bind / 智能体互联网）→ 暂定不公开（内部认知，含业界对标分析）
- server.js 端点 → 代码在 cha2a-registry 仓库（若该仓库公开则随仓库；未确认前不上传）
- 测试记录 → 内部

**原则**：测试没问题之后再定需要上传哪些；尽量少公开。

---

## 五、寻址层完整验证（2026-08-21 追加）

**Agent 消息通道核心链路全部打通（3099 实测）：**

```
电话短信 +86951230005
  → resolve（号码→agentDID）        ✅ 现有
  → locate（agentDID→sessionId）    ✅ session-bind（生产已部署）
  → send_agent_message（投递）      ✅ dsh-agent-message 1.5.1 验证
  → 目标会话收到消息                 ✅ 实测确认
```

**关键验证点：**
1. **插件自动登记** ✅：dsh-phone 插件加载后枚举 `ctx.sessions`，自动 POST session-bind（registeredBy: dsh-phone），TTL 心跳
2. **ctx.sessions 可用** ✅：`list.getSnapshot()` 枚举会话（id/agentPreset/title），`binding(sessionId).session.prompt()` 是投递原语
3. **鉴权调整**：POST session-bind 改为**开放登记（业务校验）**——对齐 phone/apply 模式（agentDid 已注册即可），浏览器插件无需 admin key；DELETE 保留 admin key。寻址劫持风险已记录（正式化用 agent 签名）
4. **agentPreset 映射**：DSH 会话的 `agentPreset: "standard"` ≠ did:cha2a 格式——需插件配置/映射决定"哪个会话是哪个 agent"

---

## 六、Agent 消息通道完整闭环（2026-08-21 追加验证）

**电话 → agent → 电话 全链路打通（3099 实测）：**

```
电话短信 "@dshlib 请回复：闭环成功"
  → resolve（号码→agentDID）        ✅
  → locate（agentDID→sessionId）    ✅ session-bind（生产已部署）
  → prompt 投递到 agent 会话         ✅（client 半 ctx.sessions.binding().session.prompt）
  → agent 处理并回复                 ✅
  → node 半轮询 readSession 捕获     ✅（sessionQuery().readSession，读 events 里 assistant/message）
  → 转回电话收件箱                   ✅（POST phone/message，to 用无空格 E.164）
  → [agent回复] 出现在电话短信区     ✅
```

**实现要点（已落地）：**
1. **client 半**：短信输入 `@agent名 内容` → resolve → locate → `binding(sessionId).session.prompt([{type:'text',text}], 'queue')` 投递
2. **node 半**：`sessionQuery().readSession(sid)` 轮询（8s），从 events 提取 `assistant/message`，索引增量去重，转回 registry 收件箱
3. **会话登记**：client 半枚举 ctx.sessions → POST session-bind（TTL 心跳）
4. **调试发现的关键点**：readSession 返回 `{session, events}`（消息在 events）；assistant/message 无 seq 字段，用索引追踪；to 号码必须无空格 E.164（+86951230001）
5. **已知局限**：agent 回复质量受提示词影响（要明确"直接回复"）；绑定会话选择不稳定（枚举选第一个 standard 会话）；agentPreset="standard" ≠ did:cha2a 需映射

---

## 七、待办（实现之后）

1. **dsh-phone 插件接入**：会话加载时登记 + 心跳 + 卸载解绑（依赖 dsh-agent-message 的投递能力验证）
2. **dsh-phone 短信侧**：resolve → locate → 投递链路（需求 2 闭环）
3. **registry.json 本地不一致**：本地仓库 registry.json 只有 9 条（生产 339 条）——需确认本地副本是否需要同步（不紧急，记录在案）
