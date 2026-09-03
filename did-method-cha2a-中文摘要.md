# did:cha2a 方法规范 — 中文摘要（非规范性）

> **以英文版为准**：本摘要为非规范性概述，帮助中文读者快速理解方法目标与机制；一切规范要求以
> `did-method-cha2a.md`（英文原文）为准，两者冲突时以英文版为准。

---

## 一、这是什么

`did:cha2a` 是一种 **AI 资源去中心化标识（DID）方法**：为 AI 生态中的资源——发布方（publisher）、
权威主体（authority）、**智能体（agent）**、技能包（skill）、软件包（package）、组织（org）、
服务提供方（provider）、独立验证方（verifier）等——分配可解析、可验证的身份。

方法名 "cha2a" 读作 "CH-A2A"：`ch` 为 complianceHub（维护方生态品牌）缩写，`a2a` 表示
agent-to-agent（智能体间通信）。

## 二、要解决什么问题

**来源溯源（source attestation）**：一个智能体/技能包/消息"是谁的、谁签发的、可信到什么程度"——
用机器可验证的方式回答，而不是靠自称。面向监管与互操作，DID 文档、信任等级、证据凭证都可由
任何一方独立核验。

## 三、核心机制

| 机制 | 说明 |
|---|---|
| **注册表（Registry）签发** | 资源在 cha2a Registry 注册后获得 DID（`did:cha2a:<type>:<id>`），Registry 签发 W3C DID 文档，验证材料为 Registry 的 Ed25519 签名公钥 |
| **双密钥** | `#registry-key`（Registry 代管，默认）+ `#agent-key`（智能体自持，私钥不出设备；"智能体本人在说话"的自证）|
| **信任等级 L0–L4** | L0 无声明 → L1 内容指纹/身份锚定 → L2 归属主体 → L3 发布方背书 → L4 生态状态（≥2 个独立已注册 verifier + 可审计证据）|
| **证据凭证（evidence）** | 第三方验证结论可注册、可追溯（predicate/verifier/result/evidenceRef），作为升级与审计依据 |
| **撤销 fail-closed** | 撤销后按不可信处理；验证依赖 Registry 不可达时**拒绝而非误判可信** |
| **号码寻址** | 号码是 Registry 资产，号段授权给 org 运营（`number-range` 授权记录公开可核验）；短信/群消息经收件箱中继 |

## 四、语法与标识规则

- `did:cha2a:<resource-type>:<resource-id>`，全部 US-ASCII
- 类型（resource-type）**必须小写**（语法强制，大写即非法）
- id **大小写敏感**（case-preserving，`Foo` 与 `foo` 是不同资源）——与上游标识符（如 GitHub 路径）字节一致，保证溯源链不断
- 无运行时规范化（不做大小写折叠/Unicode 规范化）

## 五、运营原则

- **读开放、写受控**：身份/信任/凭证/号码查询公开只读；注册/撤销等写操作需管理员密钥或签名
- **中立协议基础设施**：Registry 是"协议中立"的基础设施，独立于具体商店/公司运营
- 参考实现运行于 compliancehub.cn（Draft 阶段）；对外宣称须与实际 conformance 验证一致（声称=实有）

## 六、状态与版本

- Draft（未注册进 W3C DID Extensions registry）；当前开发态 **v0.4 (unreleased)**
- 变更流程：substantive 变更走 PR + 1 天冷静期（下限，评审者可要求延长；见规范 §9）
