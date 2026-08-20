# CHA2A Agent Identity —— 智能体身份协议分册

> 状态：讨论稿（v0.1）
> 日期：2026-08-20
> 定位：CHA2A 规范组文档（独立于 did-method-cha2a.md 主规范）——定义 `did:cha2a:agent` 智能体身份协议的语义、生命周期、交互与信任表达
> 关联：did-method-cha2a.md（§3.2 Agent 类型、§4.5 出站签名）、evidence-record.md（证据模型）、CHA2A-Scope（边界）

---

## 一、范围

本分册定义 `did:cha2a:agent` 身份协议的语义、生命周期、交互与信任表达，包括：Agent 身份生命周期（含会话身份与临时标识）、Agent 信任等级及判定条件、能力描述结构、Agent 交互场景、委托与授权范围、安全与隐私考量。Agent 类型（subject/controller/信任域/子 Agent）与出站签名机制（X-DID + X-DID-Sig）的定义见主规范 §3.2 与 §4.5。

## 二、Agent 身份模型（承接主规范 §3.2）

```
did:cha2a:agent:<instance-id>[:<agent-id>]
  subject  = 单个智能体（一个实例可注册多个 Agent，各自可寻址）
  controller = 拥有该实例的主体（持有信任锚：Ed25519 签名密钥）
  信任域   = 同一实例下的 Agent 共享一个信任锚（intra-instance agents form one trust domain）
  子 Agent = 复用宿主运行时的父子机制，不单独标识（主规范）
```

**身份语义**（对齐主规范 + 明确场景）：
1. **出站签名**（§4.5）：Agent 调用外部服务时 `X-DID` + `X-DID-Sig` 请求签名——外部服务三步验证（解析 DID → 验签 → 可选查 L0-L4 分级授权），不需要注册表集成
2. **能力发现**：DID Document 服务端点暴露 capabilities/服务（skills、tools、消息端点），见 §五
3. **委托链**：publisher（作者/组织）→ package（插件）→ Agent（运行它的智能体）——L2/L3 证据天然延伸：Agent 使用已验证插件的证据链可追溯，见 §七

## 三、Agent 身份生命周期

| 阶段 | 语义 | 操作 |
|---|---|---|
| **注册** | Agent 实例登记（type=agent），提交 capabilities/controller/owner 信息 | POST /api/v1/register |
| **持久身份** | 长期存在的 Agent 注册为 DID，可被解析/验证/审计 | 注册（persistent）|
| **会话身份** | 短期任务用临时派生标识，不占注册表公开解析（见 §3.1）| 派生 + 出站签名 |
| **短期 Agent 处置** | 一次性任务 Agent 完成后：DID 停用（deactivate）或保留为"曾存在的身份"——推荐**停用**（资源回收），证据凭证保留可查 | deactivate |
| **信任域扩展** | 实例下多 Agent 共享信任锚；跨实例交互时 DID Document 承担互认/委托/审计 | 注册多 Agent 或引用 |
| **证据绑定** | Agent 的运行验证（测试/自检）登记为 Evidence Record 凭证（subject=Agent DID，predicate=test-result / cha2a/runtime-attestation）| POST /api/v1/evidence/register |
| **吊销/撤销** | 信任吊销与 DID 停用分离（主规范 §4.4 语义）| revoke / deactivate |

### 3.1 会话身份与临时标识

会话身份用于**短期任务、隐私敏感或不可追溯**的场景，与持久身份分离：

- **形态**：临时标识由实例信任锚（controller 密钥）派生，形如 `did:cha2a:agent:<instance-id>:session:<nonce>`——nonce 唯一标识一次会话，**不注册为公开可解析的注册表记录**（或注册后按短 TTL 自动回收）
- **签名**：会话 Agent 的出站调用用会话密钥签名，消息携带 controller 的持久 DID——外部服务验证"会话密钥由已知 controller 背书"，即确认"该会话确属该实例，但会话本身不可追溯"
- **生命周期**：会话开始（派生临时密钥 + 绑定 controller 声明）→ 任务执行（出站签名）→ 会话结束（临时密钥销毁；如需审计则登记证据凭证，但身份记录不保留）
- **不追溯性**：会话标识不绑定运营者私人信息；是否在审计中保留会话痕迹由运营者策略决定（注册表只记事实，不强制）

## 四、Agent 信任等级（L0-L4 语义与判定条件）

| 等级 | Agent 场景 | 判定条件（metadata 字段）|
|---|---|---|
| L1 | Agent 运行时内容完整性 | `contentIdentity` 或 `instanceHash`（实例清单/配置哈希）|
| L2 | Agent 来源 | `controller`（运营者/组织 DID，可解析）|
| L3 | Agent 发行/托管背书 | `publisher` 或 `store`（托管方/平台声明）|
| L4 | ≥2 独立验证者聚合 | evidence/query 中 ≥2 个不同 verifier 的 test-result 凭证（subject=Agent DID）|

**与插件等级同构**：同一套 levelOf 推导、同一套 evidence/query 可下钻——机制不变，subject 换成 Agent DID。
**语义**：等级是"信任摘要"，可下钻核验；递进原则（L4 需先满足 L3 基础）与主规范一致。

## 五、能力描述结构

Agent 通过 DID Document 的 service 端点与 metadata 声明能力：

```
capabilities: {
  "skills":  [ <skill DID 或名称> ],          # 可用技能
  "tools":   [ <工具名> ],                     # 工具集
  "mcp":     [ <MCP 端点 URL> ],               # MCP 服务器
  "web":     [ <Web 服务端点> ],               # 业务服务
  "scope":   [ <授权范围声明> ]                 # 委托边界（见 §七）
}
```

- **声明 vs 验证**：能力声明（self-declared，metadata）与能力验证（第三方验证者背书的证据凭证）分离——声明只表达"宣称提供"，验证才表达"被核验"
- **可发现**：通过 DID 解析 + service 端点（如 `TrustLookup`/能力端点）发现；对齐主规范能力发现机制

## 六、Agent 交互场景

### 6.1 A2A 互认
Agent A 调用 Agent B：
1. A 解析 B 的 DID（`/api/v1/did/`），取得 B 的验证材料与服务端点
2. B 验证 A 的出站签名（X-DID + X-DID-Sig，§4.5 三步）
3. 双方可选查对方等级（trust/query），按等级差异化授权（如 L4 才允许敏感操作）
4. 交互失败路径：未注册（404）· 吊销/停用（trust 查询返回非 active）· 等级不足（按调用方策略拒绝）

### 6.2 Agent → 外部服务
Agent 调用 SaaS/MCP/计费端点：出站签名标识调用者（§4.5）；服务方可选查 L0-L4 分级授权；API key 保留为通道凭证，DID 签名为身份层——两层共存。

### 6.3 Agent → 人
人类通过 badge（`/badge/agent/<id>`）或验证页确认 Agent 身份与等级——"装前看可信度"的 Agent 版本；等级可下钻到证据凭证。

### 6.4 委托代理
Agent 代表 controller（用户/组织）行动：授权范围由 controller 声明（capabilities.scope，见 §七）；跨实例委托时 DID Document 承担委托与审计（主规范 §3.2）。

## 七、委托与授权范围

- **controller 委托**：Agent 的授权范围（capabilities 子集 + scope）由 controller 声明；scope 表达"Agent 可在什么边界内代表 controller 行动"
- **委托链验证**：publisher → package → Agent——Agent 使用已验证 package 时，package 的 L2（来源）/L3（发行）证据并入 Agent 的可信上下文：**Agent 的能力来源可沿委托链追溯**
- **撤销**：controller 撤销委托（revoke 该 Agent 的授权/信任）；信任吊销与 DID 停用分离（主规范语义）

## 八、安全与隐私考量

- **防冒用**：controller 信任锚（Ed25519 密钥）由实例持有，不进入注册表公开记录；出站签名绑定请求（method/params/timestamp/nonce，§4.5）防篡改与重放
- **密钥轮换**：主规范密钥轮换机制（overlap 期 + `/.well-known/cha2a` publicKeys 多版本）适用于 Agent 身份
- **最小披露**：DID Document 只暴露必要信息（controller/能力/服务端点）；Agent 运营者私人信息不进入公开记录
- **会话隐私**：会话身份（§3.1）不绑定私人信息、不可追溯——隐私敏感场景的默认选择
- **短期 Agent 的隐私 vs 审计**：不留痕（临时标识）与可审计（证据凭证）由运营者策略选择——注册表记录事实，不强制任一方向
- **信任边界**：等级是"信任摘要"非"安全保证"；外部服务按等级授权时自行评估风险

## 九、边界

- **身份形态**：registry-mediated DID（`did:cha2a:agent:<id>`），解析返回 W3C DID Document
- **信任表达**：L0-L4 认证等级，可下钻到机器可读证据（Evidence Record：evidenceRef + artifactDigest 防篡改）——**等级是"信任摘要"，不是聚合评分，也不是安全保证**
- **证据驱动**：每一条凭证背后是可核验的原始验证记录（in-toto 对齐）；不做行为监控类评价（CHA2A Scope：注册表只记事实）
- **国标依据**：对齐 GB/Z 185（身份码/身份管理/能力描述）机制
- **开放**：格式开放、数据可导出、任何实现可替换；与其他身份体系的互操作按需演进

## 十、参考实现

参考实现部署于 compliancehub.cn（cha2a Registry）。`type: agent` 与 package 等类型走同一套端点：注册（/api/v1/register）、解析（/api/v1/did/）、徽章（/badge/agent/&lt;id&gt;）、信任查询（/api/v1/trust/query）、证据查询（/api/v1/evidence/query）。已注册示例：`did:cha2a:agent:dshlib`（可解析，含 Agent 运行验证证据凭证）。

## 十一、开放问题（征求讨论）

1. **Agent 证据的 predicate**：test-result（运行验证）先行；runtime-attestation（§4.7 词汇）作为运行时证据的下一步
2. **会话身份密钥派生**：临时密钥由 controller 背书的精确机制（派生协议/短 TTL 注册）
3. **委托撤销传播**：controller 撤销委托后，已签发证据/已授权调用的失效语义
4. **能力验证方式**：能力声明的第三方验证（谁来验证 Agent 的 capabilities、用什么 predicate）
5. **多实例 Agent**：一个实例注册多个 Agent（各自可寻址）的落地语义

---

*本分册为讨论稿；Agent 身份语义承接主规范 §3.2/§4.5，新增生命周期、交互、委托与安全定义；以最终发布版本为准。*
