# CHA2A Evidence Record —— 智能体生态验证证据模型

> 状态：讨论稿（v0.1）
> 日期：2026-08-20
> 定位：CHA2A 规范组文档（独立于 did-method-cha2a.md 身份方法）——定义"验证产出"的机器可读格式
> 原则：**能用已有标准就不自造**——结构对齐 in-toto Attestation；predicate 能用现成直接引用，缺的定义 `cha2a/*` 命名空间
> 关联：CHA2A-Scope（边界）、GOVERNANCE_FRAMEWORK（治理认知）、#3192（讨论）、GB/Z 185（国标依据）

---

## 一、为什么需要（测试互信的载体）

**问题**：智能体插件的运行级测试成本高（资源/时间/环境），每个消费者都自己测不现实。

**出路**：**测试结果互信**——测过的验证者产出机器可读证据，其他人基于证据决策，不必重测。

**本规范的职责**：定义证据的**统一格式**（让互认成为可能）+ **引用机制**（让证据可核验）——是"测试互信"的技术基础设施。

## 二、结构对齐：in-toto Attestation（业界标准）

本规范的 Evidence Record **直接采用 in-toto Attestation 框架**（不自造结构）：

```
Envelope（封装层）     签名（DSSE）→ 验证者身份可验证
  └─ Statement（声明层）
       ├─ subject       谁（被验证对象，did:cha2a:<type>:<id>）
       ├─ predicateType 验证什么（URI，如 test-result / vuln / cha2a/content-identity）
       └─ predicate     验证详情（按 predicateType 定义）
  └─ Bundle（聚合层）   多个 attestation 集合 → 多方验证的载体（L4）
```

| in-toto 层 | 对应我们的概念 |
|---|---|
| Envelope（签名）| 验证者身份（did:cha2a:verifier:<id>，签名即身份）|
| Statement（subject/predicate）| 凭证（谁/验证什么/结果）|
| Bundle（多 attestation）| **L4 = 多方独立验证聚合** |

## 三、Predicate 集（验证什么）

**采用策略**：能用 in-toto 现成 predicate 直接引用；没有的定义 `cha2a/*` 命名空间。

| predicate | 类型 URI | 用途 | 来源 |
|---|---|---|---|
| **test-result** | `https://in-toto.io/attestation/test-result/v0.1` | **运行级测试**（result/configuration/url/passedTests）| ✅ in-toto 现成 |
| **vuln** | `https://in-toto.io/attestation/vuln/v0.1` | 依赖漏洞 | ✅ in-toto 现成 |
| content-identity | `https://compliancehub.cn/cha2a/attestation/content-identity/v0.1` | 内容完整性（npm sha512）| 🔵 自定义（对齐 §4.7 contentIdentity）|
| static-scan | `https://compliancehub.cn/cha2a/attestation/static-scan/v0.1` | 静态扫描（安全信号）| 🔵 自定义 |
| runtime-attestation | `https://compliancehub.cn/cha2a/attestation/runtime-attestation/v0.1` | 运行时验证（#3223 锚点）| 🔵 自定义（对齐 §4.7）|
| source-attribution | `https://compliancehub.cn/cha2a/attestation/source/v0.1` | 来源/作者 | 🔵 自定义（对齐 §4.6 L2）|
| issuance | `https://compliancehub.cn/cha2a/attestation/issuance/v0.1` | 发行方背书 | 🔵 自定义（对齐 §4.6 L3）|

> **命名空间**：自定义 predicate 使用 `compliancehub.cn/cha2a/attestation/*`——与 did:cha2a 方法同锚（registry 即运行于 compliancehub.cn），语义标明"CHA2A 命名空间"。

## 四、证据存储与引用（证据自持/代管 + evidenceRef）

**原则**：CHA2A registry 只登记**凭证**（Statement 摘要），**不存全量证据**；证据本体分布。

```
CHA2A 凭证（registry 存）：subject + predicateType + verifier + result + checkedAt + evidenceRef
原始证据（分布）：各验证者自持，或 dshlib 代管
evidenceRef：指向证据存档的 URL（in-toto `url` 字段的标准用法）
```

| 存储方式 | 谁用 | evidenceRef 指向 |
|---|---|---|
| **自持** | 有服务器的验证者（store 运营方 / 其他 publisher / 独立验证机构）| 验证者自己的存档（如 compliancehub.cn/store/verification/）|
| **代管** | 无服务器的验证者（个人/小团队）| dshlib 代管区（如 compliancehub.cn/evidence/<verifier>/<subject>）|

**证据可用性**：验证者登记凭证时承诺 evidenceRef 可访问；失效 → 该验证不可核验 → 信任降级（消费者可检测）。

**防篡改（可选加强）**：evidenceRef 对应内容可带哈希（`artifactDigest`），即使 URL 失效，哈希可证明"当时那份证据存在且内容如此"。

## 五、验证者身份（did:cha2a:verifier）

**新增主体类型**：`did:cha2a:verifier:<id>`（区别于 publisher——验证者不必是发行者）。

```
verifier 登记：
  - 身份（域名/org/公钥）
  - 能力声明（验证什么：完整性/运行测试/扫描）
  - 自身等级（可信度——该验证者可信到哪）
  - 登记的证据凭证（它测的 subject 清单）
```

**Envelope 签名 = 验证者身份**：attestation 由 verifier 的密钥签名（DSSE），消费者可验证"谁验证的"。

**防冒充**：验证者身份在 CHA2A 可查（did → 公钥 → 等级）——不是任何人说"我验证了"就算。

## 六、等级推导（L0-L4 从凭证聚合）

```
L1 完整性   = content-identity 凭证（任何验证者）
L2 来源     = source-attribution 凭证
L3 发行     = issuance 凭证（发行方背书）
L4 生态     = Bundle 聚合 ≥2 个独立 verifier 的凭证（不同 did，非发行者）
```

**等级是聚合展示，可下钻**：L4 不是抽象徽章，是"≥2 个独立验证者各自验证"的可查列表（每个凭证带 evidenceRef）。

## 七、界面呈现（下钻模型）

```
插件 X（L4 生态认证）：
  ├─ dshlib（did:cha2a:publisher:dshlib.com · L3）→ content-identity ✅ [evidenceRef]
  ├─ 验证者 A（did:cha2a:verifier:xxx · L?）→ test-result ✅ [evidenceRef]（运行级测试）
  └─ 验证者 B（did:cha2a:verifier:yyy · L?）→ vuln ✅ [evidenceRef]
  每个验证者身份可查（did → 公钥 → 等级），证据可下钻核验
```

## 八、与已有机制的衔接

| 已有 | 衔接 |
|---|---|
| report.json（扫描结果）| 演进为 test-result / static-scan predicate 的实例 |
| verifiedBy（L4 用）| 演化为 verifier 凭证列表（含 evidenceRef）|
| §4.7 词汇（contentIdentity/anchorGeneration）| 自定义 predicate 的语义基础 |
| CHA2A-Scope | 本规范是"标准文档"部分（In-scope），registry 仍只存凭证不存证据 |

## 九、待办与开放问题

1. **predicate 采用确认**：test-result/vuln 直接引用 in-toto（确认 URI 与版本），自定义 4 个 `cha2a/*`
2. **verifier 类型实现**：server.js 支持 did:cha2a:verifier 注册
3. **evidenceRef 落地**：现有 verifiedBy/report.json → 凭证结构（含 evidenceRef + 可选哈希）
4. **代管服务**：dshlib 提供证据代管区（evidence/<verifier>/<subject>）
5. **界面下钻**：商店验证详情页 → 验证者列表（身份/等级/证据可查）
6. **predicate URI 定稿**：当前命名空间 compliancehub.cn/cha2a/attestation/*，随规范演进确认

---

*本规范为讨论稿；结构对齐 in-toto（业界标准），predicate 语义 CHA2A 定义；对外表述以规范定稿为准。*
