# CHA2A 开放 API 规范（Agent 身份 / 信任 / 号码 / 凭证 / 检索 / 联邦 / 计量 / 协商）

> 版本：v0.2 ｜ 2026-09-03 ｜ 面向开发者（"第二份规范"：给生态的接入契约）
> v0.2 增量：检索（search）、联邦（federation peer profile）、OpenAPI 描述、企业租户计量（admin apps / usage）、A2A 协商层（negotiation）——与规范 v0.4（§1.3/§4.2.1/§7.5）及 §8 参考实现端点声明一致。
> Base URL：`https://compliancehub.cn`（RCS 消息类：`https://compliancehub.cn/rcs`）
> 原则：**读开放、写受控**。身份/信任/凭证/号码/检索/状态查询公开只读；注册/撤销/peer 变更/应用管理等写操作需管理员密钥（`X-Admin-Key`）；租户计量自报需应用密钥（`X-API-Key`）。

---

## 一、开发者场景（先看这个）

| 场景 | 用什么 | 一句话 |
|---|---|---|
| 号码解析 | `GET /api/v1/phone/resolve?number=` | 输入号码 → agent DID + 信任等级（来电/来信寻址）|
| 信任查询 | `GET /api/v1/trust/query?did=` | 输入 DID → 等级 L0-L4 + 状态（可不可信、是否撤销）|
| 凭证/证据验证 | `GET /api/v1/evidence/query?did=` | 输入 DID → 谁验证过、结果如何（可追溯证据）|
| 身份文档 | `GET /api/v1/did/<did>` | 标准 DID Document（公钥/验证方法，W3C 格式）|
| 检索资源/插件 | `GET /api/v1/search?q=` | 输入词 → registry 资源 + dshlib 插件目录命中（多词 AND）|
| 跨 registry 信任 | `GET /api/v1/registry/trust/{did}?peer=<id>` | 本地优先；未命中且配置 peer → 转发（source 标注来源）|
| 企业租户计量 | `POST /api/v1/usage`（X-API-Key）| 应用自报用量；带 key 的 search/verify/status 自动记账 |

## 二、基础信息

| 项 | 值 |
|---|---|
| Base URL | `https://compliancehub.cn` |
| RCS Base | `https://compliancehub.cn/rcs` |
| 格式 | JSON（`Content-Type: application/json`）|
| 鉴权 | 查询公开只读；写操作需 `X-Admin-Key` 或 agent 签名（见各端点）；租户计量自报需 `X-API-Key` |
| 编码 | 号码中的 `+` 需 URL 编码为 `%2B`（如 `%2B86951230001`）|
| 密钥分层 | `X-Admin-Key`（管理员，registry 运营方）；`X-API-Key`（企业租户应用，注册 app 时一次性明文下发，服务端仅存 sha256）|

> **CORS 限制（重要）**：registry API 的 `Access-Control-Allow-Origin: *` 仅放开 `Content-Type, Accept` 头——
> `X-Admin-Key` 浏览器跨站**不可携带**（预检即拒）。admin 写操作（register/update/deactivate/peers 变更/apps/revoke 等）
> 只能服务端或 curl 调用；浏览器端公开只读面不受影响。`X-API-Key` 同理仅服务端携带（计量面）。

## 三、端点一览

### 身份（registry）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/v1/did/<did>` | DID Document（公钥/验证方法）|
| GET | `/api/v1/agent/list` | 已注册 agent 列表 |
| POST | `/api/v1/register` | 注册主体（admin）——**`id` 传短名**（不含 `did:cha2a:` 前缀；传完整 did 会 400，见下方约定）|
| POST | `/api/v1/update` | 更新记录（admin）|
| POST | `/api/v1/deactivate` | 停用（admin）|
| POST | `/api/v1/agent/key/register` | 登记 agent 公钥（#agent-key）|

### 信任（registry）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/v1/trust/query?did=` | 信任等级 + 状态（核心）|
| GET | `/api/v1/trust/revocations` | 撤销列表 |
| POST | `/api/v1/trust/revoke` | 撤销（admin）|
| GET | `/api/v1/verify/agent-sig` | 出站签名验签 |

### 凭证 / 证据（registry）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/v1/evidence/query?did=` | 凭证列表（可追溯证据）|
| POST | `/api/v1/evidence/register` | 登记凭证（验证者，签名）|

### 号码（registry）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/v1/phone/resolve?number=` | 号码 → agent DID + 等级（寻址核心）|
| GET | `/api/v1/phone/lookup?did=` | DID → 号码 |
| GET | `/api/v1/phone/directory` | 号码簿（公开目录）|
| POST | `/api/v1/phone/apply` | 开户申请（送体验额度）——**`agentDid` 传完整 did**（与 register 短名区分）|

> **标识符约定（B1 澄清，2026-09-02）**：`POST /api/v1/register` 的 `id` 是**短名**
> （如 `myagent` → 生成 `did:cha2a:agent:myagent`）；`POST /api/v1/phone/apply` 的 `agentDid`
> 是**完整 did**。两处端点职责不同（register=建主体、apply=给已注册主体开户），标识符形态也因此
> 不同——**不允许把完整 did 当短名 id 传入 register**（服务端 400 拒绝，防嵌套畸形
> `did:cha2a:agent:did:cha2a:agent:x`）。客户端实现请注意两套约定。
| POST | `/api/v1/phone/register` | 绑定号码（admin）|
| POST | `/api/v1/phone/deactivate` | 停用号码（admin）|

### 号段（registry，admin）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/v1/number-ranges` | 号段列表 |
| POST | `/api/v1/number-range/grant` | 授权号段给 org（admin）|

### 额度计费（registry）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/v1/phone/credits?did=` | 余额查询 |
| POST | `/api/v1/phone/credits/purchase` | 充值下单（¥1/¥10/¥100）|
| POST | `/api/v1/phone/credits/confirm` | 确认支付入账 |
| POST | `/api/v1/phone/credits/consume` | 扣费（服务端内部，需鉴权）|
| GET | `/api/v1/phone/credits/ledger?did=` | 账单流水 |

### 检索（registry + catalog，只读免登录）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/v1/search?q=` | 检索 registry 资源（type/id/name/author/publisher/capabilities 等）与 dshlib 插件目录——多词 AND 子串匹配；`q` 必填（缺失 400）；registry ≤50 条、catalog ≤20 条；带 `X-API-Key` 自动计量 |

### 联邦（federation peer profile，v0.4 §4.2.1）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/v1/registry/status` | 本 registry DID + 部署能力 + 配置的 peer 名册（只读；带 `X-API-Key` 自动计量）|
| GET | `/api/v1/registry/peers` | peer 名册（只读，含 trustPath 配置）|
| POST | `/api/v1/registry/peers` | 增改 peer（admin；`id` 限 `[A-Za-z0-9._\-]`，`baseUrl` 必须 http(s)://，可选 `trustPath`）|
| DELETE | `/api/v1/registry/peers/<id>` | 删除 peer（admin；不存在 404）|
| GET | `/api/v1/registry/trust/{did}?peer=<id>` | 信任查询：**本地优先** → 未命中且有显式配置 peer 才转发 → fail-closed。`source: local` / `source: peer:<id>`；peer 返回非 200 → 502 带 peer；peer 不可达 → 502；无 peer → 404（提示可 ?peer= 转发）|

> **联邦语义（与规范 §4.2.1/§7.5 一致）**：只转发到**显式配置**的 peer，不做隐式发现；转发只读、fail-closed（surface 来源 peer 与上游结果，不编造）；本地未注册的 DID 若对端也未命中 → 透传上游 404 形态的 fail-closed。

### API 描述

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/v1/openapi.json` | OpenAPI 3.0.3 最小静态子集（20 paths；`x-cha2a.note` 标注"最小静态子集、规范为准"）|

### 企业租户计量（admin apps / usage）

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/v1/admin/apps` | 注册应用（admin）——返回 `{ app: {id,name,ownerDid}, apiKey }`；`apiKey` **仅创建时一次性明文返回**，服务端只存 sha256 |
| GET | `/api/v1/admin/apps` | 应用列表（admin；不含 key 材料）|
| POST | `/api/v1/usage` | 自报用量（`X-API-Key`；`{endpoint, amount?}`；缺 key 401、缺 endpoint 400）|
| GET | `/api/v1/admin/usage` | 用量明细（admin；`?app=&endpoint=` 过滤；最近 200 条倒序）|

> **自动计量**：带 `X-API-Key` 访问 `search` / `verify/artifact` / `registry/status` 会自动记 app-usage（无需显式上报）。

### A2A 协商层（B，状态机）

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/v1/negotiation/start` | 发起协商：`{initiatorDid, targetDid, goal}` → 201 建项（phase=INFORMATION，active）；did 非法/缺 goal → 400 |
| POST | `/api/v1/negotiation/receive` | 推进阶段：`{id, phase, note?}`；状态机 `INFORMATION → TARGET → FEASIBILITY → ACCEPTED/REJECTED`（可跳 TARGET；**关闭必须过 FEASIBILITY**，否则 409；phase 不前进 409；已关闭 409；非法 phase 400）|
| GET | `/api/v1/negotiation/list?did=` | 按 initiator/target did 列出（≤100 条倒序）|
| GET | `/api/v1/negotiation/{id}` | 单条详情（不存在 404）|

### RCS 消息 / 群（rcs-server，`/rcs` 前缀）

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/rcs/api/v1/phone/message` | 发送消息 |
| GET | `/rcs/api/v1/phone/messages?did=` | 收件箱（增量 seq 游标）|
| POST | `/rcs/api/v1/phone/group` | 建群 |
| GET | `/rcs/api/v1/phone/group/list?did=` | 群列表 |
| GET | `/rcs/api/v1/phone/group/<id>/messages?since=` | 群历史（增量）|
| POST | `/rcs/api/v1/phone/group/message` | 群消息广播 |
| POST | `/rcs/api/v1/phone/attachment` | 附件上传 |
| GET | `/rcs/api/v1/phone/attachment/<fileId>` | 附件下载 |

## 四、核心端点示例

### 1. 号码解析（寻址）

```bash
curl "https://compliancehub.cn/api/v1/phone/resolve?number=%2B86951230001"
```
```json
{"number":"+86951230001","registered":true,"agentDid":"did:cha2a:agent:dshlib",
 "trust":{"level":2,"name":"L2 source"},"suspicious":false}
```

**`suspicious` 字段定义（B3 澄清，2026-09-02）**：号码解析响应的**风险派生标记**，非独立风险信号——
`suspicious = true` 当且仅当该号码对应的 DID 不可信（未注册号码 / 绑定 DID 未找到 / `!active` / `revoked` /
`level === 0`），并附 `reason` 说明（`unregistered number` / `bound DID not found` / 等级或状态原因）。
`false` 表示号码绑定到可信（level≥1 且 active 未撤销）DID。消费方不应把 `suspicious` 当额外风险维度，
它就是等级/状态的低级便捷汇总。

### 2. 信任查询（等级 + 状态）

```bash
curl "https://compliancehub.cn/api/v1/trust/query?did=did:cha2a:agent:dshlib"
```
```json
{"did":"did:cha2a:agent:dshlib","registered":true,"active":true,"level":2,
 "levelName":"L2 source","revoked":false,
 "metadata":{"name":"dshlib","author":"演示操作员","agentPublicKey":"..."}}
```

### 3. 凭证/证据查询（可追溯）

```bash
curl "https://compliancehub.cn/api/v1/evidence/query?did=did:cha2a:agent:dshlib"
```
```json
{"subject":"did:cha2a:agent:dshlib","count":1,
 "credentials":[{"id":"cred-...","subject":"did:cha2a:agent:dshlib",
  "predicateType":"https://in-toto.io/attestation/test-result/v0.1",
  "verifier":"did:cha2a:verifier:dshlib","result":"passed", ...}]}
```

### 4. 身份文档（DID Document）

```bash
curl "https://compliancehub.cn/api/v1/did/did:cha2a:agent:dshlib"
```
```json
{"@context":["https://www.w3.org/ns/did/v1","https://w3id.org/security/suites/ed25519-2020/v1"],
 "id":"did:cha2a:agent:dshlib",
 "verificationMethod":[{"id":"did:cha2a:agent:dshlib#registry-key","type":"Ed25519VerificationKey2020",...}]}
```

### 5. 检索（registry + 插件目录，只读）

```bash
curl "https://compliancehub.cn/api/v1/search?q=dsh-phone"
```
```json
{"q":"dsh-phone","count":3,
 "registry":[{"did":"did:cha2a:package:@wwumit/dsh-phone","type":"package","id":"@wwumit/dsh-phone",
   "name":"dsh-phone","level":3,"levelName":"L3","status":"active"}],
 "catalog":[{"kind":"catalog","name":"dsh-phone","description":"...","tags":["L3"],"did":"did:cha2a:package:...","source":"npm"}]}
```
（无 `q` → 400 `provide ?q=`；多词空格分隔为 AND。）

### 6. 联邦：状态与跨 registry 信任（本地优先）

```bash
curl "https://compliancehub.cn/api/v1/registry/status"
curl "https://compliancehub.cn/api/v1/registry/trust/did:cha2a:agent:peer-resident?peer=peer-b"
```
```json
{"registryDid":"did:cha2a:registry:compliancehub.cn","version":"1.0",
 "capabilities":["trust-lookup","trust-proof","evidence","phone","federation"],
 "peers":[{"id":"peer-b","baseUrl":"https://peer-b.example","status":"configured"}]}
```
```json
{"source":"local","did":"...","registered":true,"level":2,...}            // 本地命中
{"source":"peer:peer-b","registered":true,"level":3,...}                  // 本地未命中→显式 peer 转发
{"error":"peer unreachable: ...","peer":"peer-b"}                          // 502：peer 不可达 fail-closed
```

### 7. 企业租户：注册应用（admin，curl 仅限）与用量自报

```bash
# 注册应用（X-Admin-Key 服务端携带；响应含一次性明文 apiKey）
curl -X POST https://compliancehub.cn/api/v1/admin/apps -H "X-Admin-Key: $ADMIN" \
  -H "Content-Type: application/json" -d '{"name":"my-tenant-app","ownerDid":"did:cha2a:org:acme"}'
# 用量自报 / 自动计量
curl -X POST https://compliancehub.cn/api/v1/usage -H "X-API-Key: $KEY" \
  -H "Content-Type: application/json" -d '{"endpoint":"/api/v1/search","amount":1}'
curl "https://compliancehub.cn/api/v1/admin/usage?app=app-xxx" -H "X-Admin-Key: $ADMIN"
```
```json
{"ok":true,"app":{"id":"app-xxx","name":"my-tenant-app","ownerDid":"did:cha2a:org:acme"},"apiKey":"<一次性明文，只显示这一次>"}
{"ok":true,"app":"app-xxx","endpoint":"/api/v1/search","amount":1}
```

### 8. A2A 协商（状态机：INFORMATION → TARGET → FEASIBILITY → ACCEPTED/REJECTED）

```bash
curl -X POST https://compliancehub.cn/api/v1/negotiation/start \
  -H "Content-Type: application/json" \
  -d '{"initiatorDid":"did:cha2a:agent:a","targetDid":"did:cha2a:agent:b","goal":"data-processing-sla"}'
# 推进：跳到 FEASIBILITY，再 ACCEPTED（关闭必须过 FEASIBILITY，否则 409）
curl -X POST https://compliancehub.cn/api/v1/negotiation/receive \
  -H "Content-Type: application/json" \
  -d '{"id":"nego-xxx","phase":"FEASIBILITY","note":"capacity ok"}'
curl -X POST https://compliancehub.cn/api/v1/negotiation/receive \
  -H "Content-Type: application/json" -d '{"id":"nego-xxx","phase":"ACCEPTED"}'
```
```json
{"ok":true,"item":{"id":"nego-xxx","initiatorDid":"did:cha2a:agent:a","targetDid":"did:cha2a:agent:b",
  "goal":"data-processing-sla","phase":"ACCEPTED","status":"accepted","history":[...]}}
```

## 五、信任等级（L0-L4）

| 等级 | 名称 | 语义 |
|---|---|---|
| L0 | 未认证 | 未声明 |
| L1 | integrity | 身份锚定密钥验签（#agent-key，出站签名可验）|
| L2 | source | 归属绑定（owner-binding + 号段授权）|
| L3 | issuance | 背书链（发行方/验证方签发）|
| L4 | ecosystem | 多方独立验证（预留）|

## 六、错误码

| 码 | 含义 |
|---|---|
| 400 | 参数错误（无效 DID/号码/缺 q/非法 phase）|
| 401 | 缺少/错误管理员密钥（写操作）或缺少应用密钥（usage）|
| 404 | 不存在（未注册/号码不在簿/negotiation 无此 id）|
| 409 | 冲突（重复注册/已撤销/协商已关闭/phase 不前进/未过 FEASIBILITY 关闭）|
| 402 | 余额不足（消息计费）|
| 502 | 联邦转发失败：peer 返回错误或不可达（带 `peer` 字段；fail-closed）|

> **发现（.well-known）**：`GET https://compliancehub.cn/.well-known/cha2a` 的 `endpoints` 声明本规范全部端点
> （含 `search`、`openapiSpec`、`registryStatus`、`registryPeers`、`registryTrust`），`capabilities` 含 `federation`；
> 与规范 v0.4 §5.2 一致。

## 七、接入示例（伪代码，任意语言）

```
function verifyAgent(did):
    t = GET /api/v1/trust/query?did=did
    if not t.registered or t.revoked: return REJECT
    if t.level < 2: return REJECT           # 门禁：L2+ 才放行
    e = GET /api/v1/evidence/query?did=did  # 可选：看验证证据
    return ALLOW(t.level)
```

---

*开放契约，欢迎任何平台接入。写操作鉴权与签名规范见 CHA2A 规范（did-method-cha2a）。*
