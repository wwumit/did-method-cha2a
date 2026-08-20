# 证据凭证最小闭环（Evidence Record 落地实验）

> 状态：实验计划（v0.1）
> 日期：2026-08-20
> 原则：**发出去之前先跑通**——规范/回帖发布的前提是"发完就能测"；每步可回退；属实验范畴，不铺开
> 关联：evidence-record.md（规范草案）、#3192（回应 denial 的实底）、EXPERIMENT_PLAN.md（comm 运行时实验，本实验是**服务层**闭环，与之并行）

---

## 一、要验证的核心假设

"**统一格式（in-toto 结构）的证据凭证，从登记 → 查询 → 下钻核验的完整链路能跑通**"——测试结果互信从"讨论"变成"可操作"，回应 #3192 时有实底。

## 二、最小闭环定义（最小到什么程度）

一张 **test-result 证据凭证**的完整旅程：

```
验证者产出证据（test-result predicate，in-toto Statement 结构）
   ↓ 封装 + 签名（Envelope，验证者身份）
   ↓ 存代管区 → evidenceRef 可访问（https://compliancehub.cn/evidence/<verifier>/<subject>）
   ↓ registry 登记凭证（subject + predicateType + verifier + result + checkedAt + evidenceRef）
   ↓ 查询（evidence/query 返回该凭证；trust/query 原结构不变）
   ↓ 界面下钻（verification 页显示证据凭证，evidenceRef 可打开）
```

**只用 1 个 predicate（test-result）+ 1 个 verifier（dshlib）+ 1 个 subject（dsh-travel-plan）**，其余 predicate/验证者后续按同构扩展。

## 三、实验形态（安全隔离）

```
不新建服务 —— 复用现有三件套：
  cha2a-registry（server.js，8787 → nginx 443）   ← 加证据端点（纯新增路由）
  nginx /evidence/ 静态代管区                       ← 新增 location（加前先查规则，防覆盖 alias 的坑）
  dshlib 商店 verification 页                        ← 加证据凭证区块（下钻链接）
数据只加不改：凭证表新增，现有 403 条列表/badge/trust query 原行为不动
```

## 四、执行步骤与回退点（每步记录"怎么回退"）

| 步骤 | 动作 | 回退方式 | 回退风险 |
|---|---|---|---|
| **S0** | 快照：备份 server.js、nginx conf（registry 相关 location）、verification 派生脚本 | 备份已存 | 无 |
| **S1** | server.js：新增 `did:cha2a:verifier` 类型支持 + `POST /api/v1/evidence/register` + `GET /api/v1/evidence/query`（凭证表扩展 predicateType/evidenceRef/verifier 字段）| 纯新增路由+字段，删代码段即回退 | 低：不动现有路由 |
| **S2** | 生成样例证据 JSON（test-result，Statement 结构：subject/predicateType/predicate 含 result+configuration+url），本地脚本产出 | 删文件即回退 | 无 |
| **S3** | nginx 加 `location /evidence/` 静态目录（**先确认与现有 location 顺序，防覆盖 alias**）| 注释掉 location 即回退 | 低（有前车之鉴，先验证）|
| **S4** | 登记：curl register（证据凭证落库）→ 查询：evidence/query 验证返回 | 删除该凭证记录 | 无 |
| **S5** | verification 页单插件页加"证据凭证"区块（predicateType/verifier/evidenceRef 链接）| 还原派生脚本 | 低 |
| **S6** | 端到端验收（见 §六）→ 记录实证结果 | 快照恢复 | 无 |

## 五、安全护栏（现有服务零影响为硬约束）

**已布局并完成验证的服务（本实验零改动、零影响）**：
- registry 现有端点：register / update / did 解析 / trust-proof / trust-query / trust-revoke / revocations / deactivate / dshlib-submissions / catalog / verification / stats
- 现有数据：403 条插件记录、等级徽章（L0-L4）、verifiedBy 摘要
- 商店页面：/store/ 列表、verification 总表与单插件页、分类、badge 展示
- nginx：现有全部 location（含 dshlib-store、cha2a-registry 代理、verification 派生路径）

护栏：
1. **纯新增**：证据端点/凭证字段/静态目录全是新增；**证据凭证独立存储**（新表/新文件），不混入现有 trust 数据结构
2. **备份先行**：server.js / nginx conf / 派生脚本 S0 快照，可一键回滚
3. **数据只加不减**：现有 403 条、徽章、verifiedBy 原样不动
4. **verification 页只追加区块**：已有渲染逻辑不改，证据区块是独立 DOM 段
5. **不发对外材料**：验收通过前不回应 #3192、不发布规范、不推广（发出去 = 跑通后）
6. **不出现候选域名**：文档/代码/对外材料不出现候选域名（防抢注）；命名空间统一 compliancehub.cn/cha2a/attestation/*
7. **实验边界**：只做服务层最小闭环；运行时验证（#3223 锚点）、其余 predicate 不在本实验范围

## 六、验收标准

**✅ 全部通过（2026-08-20 实证）**

- [x] `register` 成功：凭证落库（含 predicateType/verifier/evidenceRef/checkedAt/artifactDigest）
- [x] `evidence/query` 返回该凭证；**trust/query 原响应结构不变**
- [x] `evidenceRef` URL 公网可打开（HTTP 200，代管 JSON 与登记一致）
- [x] verification 页显示证据凭证区块，可下钻到 evidenceRef
- [x] **无回归（逐项核对）**：catalog 403 条、badge（斜杠形式）、trust/query、did 解析、.well-known、商店全部页面、verification 总表/单插件页、nginx 各 location 全部 200；badge `~` 形式 404 为原有行为（非回归）
- [x] 实证记录已存档（本文件 §九）

**实证链路（公网可查）**：
- 凭证：`GET /api/v1/evidence/query?did=did:cha2a:package:cosmic-snail/dsh-travel-plan` → 1 条 test-result 凭证（verifier `did:cha2a:verifier:compliancehub.cn`，result=passed，evidenceRef 指向代管 JSON）
- 证据：`https://compliancehub.cn/evidence/compliancehub.cn/cosmic-snail~dsh-travel-plan/test-result.json`（in-toto Statement v1 + test-result predicate，artifactDigest=sha256:d9da3217…）
- 界面：`https://compliancehub.cn/store/verification/cosmic-snail~dsh-travel-plan.html`（证据凭证区块）
- 验证者：`did:cha2a:verifier:compliancehub.cn`（capabilities: run-tests/integrity）

## 八、如何邀请其他人参与（参与设计）

**核心逻辑**：测试结果互信的价值 = 验证者越多越值钱（L4 = ≥2 独立验证者聚合）。参与机制要**门槛递减、回报可见**：

**两类参与角色**：
| 角色 | 做什么 | 参与入口 |
|---|---|---|
| **验证者**（verifier）| 用自己的工具（GuardDog/OSV/自建测试）产出证据，登记凭证 | 注册 verifier 身份 → 登记凭证（API 文档 + 活样例）|
| **消费者**（consumer）| 查 trust/query（信任摘要）+ evidence/query（证据明细）+ 打开 evidenceRef，用证据做决策 | 公开 API，零成本、零注册 |

**参与三步走（门槛递减）**：
1. **看**（零门槛）：verification 页公开展示"谁验证过、证据可查"→ 看懂这是什么
2. **查**（零门槛）：trust/query（摘要）+ evidence/query（明细）公开 API → 消费者直接用，无需注册
3. **验**（低门槛）：注册 verifier → 产出证据 → 登记凭证（样例已跑通，照着做即可）

**零门槛设计**：
- **代管服务**：无服务器的验证者直接用 dshlib 代管区（evidenceRef 即开即用，零基础设施）
- **署名/可见**：验证记录永久可查、商店页面署名 → 参与有回报（声誉资产）
- **信任叠加**：L4 聚合多个独立验证者 → 参与者越多，生态等级越高（正向循环）
- **API 公开免费**：register/query 无鉴权门槛（身份可查即防冒充）

**第一个邀约对象（务实，已有意愿）**：
- **#3192 denial123789**：已表态愿做**消费者侧试验**——闭环跑通后第一个邀请（消费者侧用 trust/query + evidenceRef 做决策），正好验证 L4 本意（测试结果互信），且不依赖我们服务器（证据开放格式）
- 验证者侧：下一个邀请外部工具方（GuardDog/OSV 生态）产出真实漏洞证据

**不做什么**：不做市场、不强制参与、不审核验证者内容（CHA2A Scope：注册表中立，验证者自我声明 + 可查 + 防冒充）

## 七、需确认的（开工前）

1. **verifier 身份**：dshlib 以 `did:cha2a:verifier:compliancehub.cn`（或复用现有 publisher 身份加 verifier 声明）登记——倾向独立 verifier 类型（规范 §5 已定义）
2. **evidenceRef 形态**：`https://compliancehub.cn/evidence/dshlib/dsh-travel-plan/test-result.json`，内容带可选 artifactDigest 哈希
3. **凭证查询独立端点**：**新增 `GET /api/v1/evidence/query?did=X`**（可按 verifier/predicateType 过滤），**trust/query 原响应结构零改动**（保"现有服务零影响"）；verification 页下钻时由界面层调 evidence/query 聚合——摘要/明细分层，响应不膨胀
4. **subject**：dsh-travel-plan（闭环已跑通的插件，可产出真实 test-result 证据）

*本实验为内部路径；验收通过后按实证结果决定对外发布节奏。*

## 九、实证记录（2026-08-20 最小闭环完成）

**服务变更（全部纯新增/追加，S0 快照可回滚）**：
1. `server.js`：`POST /api/v1/evidence/register`（校验 subject/predicateType/verifier/result/evidenceRef；**verifier 必须已注册，防冒充 409**）+ `GET /api/v1/evidence/query`（可按 verifier/predicateType 过滤）；凭证存独立 `data/evidence.json`，registry.json/revocations.json 零改动；`/.well-known/cha2a` 增 evidence 能力声明
2. `nginx`：`location /api/v1/evidence/` → 8787；`location /evidence/` → alias `/var/www/dshlib-store/evidence/`（代管区，与 /store/ 平行，不影响现有 location）
3. `derive_display.py`：`verify_plugin_page` 追加"证据凭证"区块（读 evidence.json 按 DID 挂载；无凭证插件页不渲染区块，已有渲染零改动）

**关键决策落地**：trust/query 原结构不变（独立 evidence/query）；证据凭证独立存储；artifactDigest 防篡改；~ 替代 / 规避 nginx %2F（与 verification 页一致）。

**回滚路径**：S0 快照在服务器 `/opt/cha2a-registry/backups/s0-20260820/`（server.js/derive_display.py/app.js/nginx-full.conf/compliancehub.cn.conf）→ 还原 + `systemctl restart cha2a` + `nginx -t && reload` + 重跑 derive。
