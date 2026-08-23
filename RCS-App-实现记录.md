# RCS 群聊 App 第一版：实现记录

> 日期：2026-08-21
> 状态：已实现并验证（生产 registry + 3099 UI）· 未开源
> 对应：dsh-phone-群聊打通设计草案.md（v4）、dsh-phone-App化架构.md、dsh-phone-架构总览.md

---

## 一、实现内容

### 1. registry 侧（groups.js，逻辑独立模块）

新增 `groups.js`（对齐 session.js 模式），server.js 一行委托：

| 端点 | 方法 | 说明 |
|---|---|---|
| `/api/v1/phone/group` | POST | 创建群（creator 人号码/agent DID + 成员号码列表）|
| `/api/v1/phone/group/list` | GET | 群列表（我是成员/创建者）|
| `/api/v1/phone/group/<id>` | GET | 群详情（成员）|
| `/api/v1/phone/group/member` | POST/DELETE | 加/移除成员（X-Admin-Key）|
| `/api/v1/phone/group/message` | POST | 群广播（复用 message 中继，进各成员收件箱，带 groupId）|

数据：`data/groups.json`（群名/成员号码列表/创建者/时间）。

### 2. dsh-phone RCS App（client 半）

- **独立界面**：💬 按钮 → 群列表（我的群）→ 群会话（消息流 + @ 人/agent + 输入框）
- 多群支持（群列表 state）
- 群消息经 registry（group/message 广播 + 收件箱拉取，带 groupId 过滤）
- **@agent 投递复用**：`sendSmsToAgent` 抽成共用函数，支持 source=sms/group + groupId

### 3. 回复路由（node 半）

- 来源标记扩展：`source: "group"` + `groupId`
- 回复路由：source=group → 回群广播（group/message），source=sms → 回单号码
- 已验证：agent 回复"群测试三" → 回群广播 → 群消息流出现 `[agent回复]`

## 二、验证结果（3099 端到端）

```
人发群 @dshlib 请回复：群测试三
  → 群广播（group/message，全部成员收件箱，带 groupId）
  → agent 收到（source=group 来源标记，resolve→locate→prompt 投递）
  → agent 回复"群测试三"
  → node 半路由回群（group/message 广播）
  → 群消息流出现 [agent回复] 群测试三 ✅
```

| 用例 | 结果 |
|---|---|
| 建群（人号码 + agent DID 混合成员）| ✅ |
| 群列表 / 群详情 / 加成员 | ✅ |
| 群广播（多成员收件箱）| ✅ |
| @agent 群消息 → agent 投递 | ✅ |
| agent 回复 → 回群广播 | ✅ |
| 核心服务回归 | ✅ 全 200 |

## 三、成员模型（定稿，符合设计）

- 群成员 = 号码列表（人=phone 号码，agent=自己号码）
- resolve 定角色（group/message 广播时：号码→号码簿 agentDID，agent DID→直接投递）
- 符合 RCS MSISDN 哲学（设计草案 §2.2）

## 四、回退方案

- 备份：`/opt/cha2a-registry/backups/pre-rcs-20260821-165703/`（server.js + session.js + 全部 data）
- registry 回退：恢复 server.js + 删 groups.js + 重启
- dsh-phone 回退：git 恢复（本地 repo 未 push，改动在工作区）

## 五、未完成/待办

1. **群创建 UI**（现在用 curl/API 建群，UI 只读群列表）
2. **群消息持久独立**（现在复用收件箱，群消息和短信混在 inbox；后续可独立 group 消息流）
3. **群消息轮询**（现在打开群会话拉一次 + 复用短信轮询；后续群独立增量）
4. **@agent 群消息的 currentSource 时序**（调试发现 seenCount 竞态，已缓解但可优化）
5. **附件群共享**（MVP 后）
6. **设计文档的 UI 形态**（App 化 Launcher 正式化——现在 💬 还是 tab，不是独立 Launcher 入口）

## 六、合规

- 全部本地，未上传 GitHub / 未发帖
- 测试群/群消息已清理（groups.json + inbox）
- 调试代码已清理（node 半无 fs 日志）
