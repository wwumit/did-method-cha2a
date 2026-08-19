# cha2a 最小闭环 —— 实证记录（2026-08-18）

零依赖 Node 实现（node:crypto + node:http，无 npm 依赖、无外部网络请求），
证明 P0-1（可运行）、P0-2（真实资源注册）、P0-4（签名验证闭环）、P0-5（独立自持）。

## 1. 注册 publisher
POST /api/v1/register {"type":"publisher","id":"compliancehub.cn"}
→ 201 {"did":"did:cha2a:publisher:compliancehub.cn",...}

## 2. 注册 skill
POST /api/v1/register {"type":"skill","id":"skill-compliance","metadata":{name,description,author:"wwumit",license:"Apache-2.0"}}
→ 201 {"did":"did:cha2a:skill:skill-compliance",...}

## 3. Discovery
GET /.well-known/cha2a
→ {"capabilities":["trust-proof","revocation"],"publicKeys":[{algorithm:"Ed25519",status:"signing"}],
   "registryDid":"did:cha2a:registry:compliancehub.cn","supportedMethods":["did:cha2a"],"version":"1.0"}

## 4. 解析 publisher
GET /api/v1/did/did:cha2a:publisher:compliancehub.cn
→ 200 Content-Type: application/did+ld+json
   {"@context":[...],"id":"did:cha2a:publisher:compliancehub.cn",
    "verificationMethod":[{type:"Ed25519VerificationKey2020",controller:"did:cha2a:registry:compliancehub.cn",
      "publicKeyMultibase":"z6Mk..."}],
    "authentication":[...],"assertionMethod":[...],"service":[TrustLookup,TrustProof,TrustBadge]}

## 5. 解析 skill（同上结构）

## 6. 签发 trust proof
GET /api/v1/trust/proof?did=did:cha2a:skill:skill-compliance
→ {"did":...,"proof":{"type":"Ed25519Signature2020","purpose":"assertionMethod","signatureValue":"..."}}

## 7. 独立验签（verify.js，仅凭 discovery 公钥，不接触私钥）
→ signature: ✅ VALID (exit 0)

## 8-10. 错误语义
→ 未注册资源 404 {"error":"resource not found: agent/not-registered"}
→ 非法语法 400 {"error":"syntactically invalid did: ..."}
→ 重复注册 409 {"error":"resource already registered: skill/skill-compliance"}

## 独立自持（P0-5）
- 零依赖：无 npm install；仅 node 内置模块
- 无外部网络请求：全部流程本地完成，不访问任何境外站点
- 验证者只信任 discovery 公钥（HTTP 获取），不接触私钥

## 补充演示（v0.2 增强端点，2026-08-18 二次实测）

## 11. trust lookup（认证等级查询）
GET /api/v1/trust/query?did=did:cha2a:skill:skill-compliance
→ {"level":2,"levelName":"L2 source","active":true,"revoked":false}

## 12. 注册 L4 示例（带 contentHash+author+publisher+evidence）
POST /api/v1/register {"type":"skill","id":"skill-governance","metadata":{author,contentHash,publisher,evidence}}
→ {"level":4,"levelName":"L4 ecosystem"}   # 认证等级判定（附件 C 逻辑落地）

## 13. trust lookup 双入口一致
?type=skill&name=skill-governance  ≡  ?did=did:cha2a:skill:skill-governance

## 14. badge（SVG）
GET /badge/skill/skill-governance → SVG（L4 紫色徽章；revoked 变红 #c92a2a）

## 15. revoke
POST /api/v1/trust/revoke {"did":...,"reason":"demo"} → {"revoked":true}
→ trust lookup revoked:true；badge 变红；proof 签发被拒 409

## 16. revoked 后签发被拒
GET /api/v1/trust/proof?did=<revoked> → 409 {"error":"trust not issuable: resource revoked"}

## 17. deactivate
POST /api/v1/deactivate {"did":...,"status":"suspended"}
→ 解析返回 {didDocument, didDocumentMetadata:{deactivated:true,status:"suspended"}}（规范 §4.4）

## 18. revocations 列表
GET /api/v1/trust/revocations → {"revocations":[{did,reason,at}]}

## 回归
核心链路（注册/解析/discovery/签发/独立验签）在增强后全部保持通过（✅ VALID exit 0）。

## 服务器部署实证（2026-08-18 部署 compliancehub.cn）

部署形态：Node 监听 127.0.0.1:8787（不暴露公网端口），nginx 443 反向代理 4 个路径，
复用现有 443 证书。公网 HTTPS 端点：

- https://compliancehub.cn/.well-known/cha2a            → discovery（HTTP 200）
- https://compliancehub.cn/api/v1/did/<did>             → DID 解析（200，application/did+ld+json）
- https://compliancehub.cn/api/v1/trust/query?did=..    → 信任查询（含认证等级）
- https://compliancehub.cn/badge/<type>/<id>            → SVG 徽章（200, image/svg+xml）

独立验签（服务器 verify.js，公网 discovery 公钥）：✅ VALID

回归（原有服务零影响）：
- 首页 https://compliancehub.cn/ 200（45KB，公安备案页脚在）
- /api/v1/rules 200（FastAPI 8000 正常）
- /ops/ 200（运营后台正常）
- /shell 444（安全加固规则仍生效）
- /api/v1/stats/ 404 与 /api/ 404 均为原有应用行为（直连 8000/3000 复现）

配置备份：/etc/nginx/sites-enabled/compliancehub.cn.bak-cha2a-20260818-231518

## 1:N 包-技能关系与内容身份演示（2026-08-18 二次实测）

## 19. 注册 package（完整性/签名单元，可含多技能）
POST /api/v1/register {"type":"package","id":"compliancehub-skill-pack","metadata":{...contentHash}}
→ did:cha2a:package:compliancehub-skill-pack (L2)

## 20. 同一技能被两个包打包（contentIdentity 相同 → 同一内容、两个发行实例）
skill-compliance         contentIdentity: sha256:skill-content-001  bundle: pack A
skill-compliance-other    contentIdentity: sha256:skill-content-001  bundle: pack B
→ trust lookup 比对：哈希一致 = 内容相同，实例/验证链不同

## 21. 被修改后打包（contentIdentity 不同 + derivedFrom 声明 → 内容不同，诚实标注衍生）
skill-compliance-fork     contentIdentity: sha256:skill-content-002  derivedFrom: sha256:skill-content-001
→ name 相同但 contentIdentity 不同 = 明确的"不是同一个"，防同名冒充
