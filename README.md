# did:cha2a — Method Specification & Registry

Specification and normative documents for the **`did:cha2a`** DID method —
a registry-mediated identity method for agents, skills, publishers, and
authorities in the agent ecosystem.

`did:cha2a` is a registry-mediated identity method: `ch` abbreviates
**complianceHub**, `a2a` denotes agent-to-agent. A `did:cha2a` identifier names
a resource (publisher, authority, agent, skill, MCP server, AI tool, LLM, or
the registry itself) registered in a cha2a Registry.

## Documents

| Document | Content |
|---|---|
| [`did-method-cha2a.md`](./did-method-cha2a.md) | The DID method specification (ABNF, operations, security model) |
| [`agent-identity.md`](./agent-identity.md) | Agent identity protocol volume: lifecycle, L0–L4 semantics & criteria, capability structure, delegation, security & privacy |
| [`evidence-record.md`](./evidence-record.md) | Evidence Record — in-toto-aligned verifiable credential model |
| [`EVIDENCE.md`](./EVIDENCE.md) / [`EVIDENCE_MIN_LOOP.md`](./EVIDENCE_MIN_LOOP.md) | Evidence & minimal-loop records |
| [`CHANGELOG.md`](./CHANGELOG.md) | Revision history |

## Status

**Experimental.** Certification levels map the ecosystem proposal's annex C:
**L0** none · **L1** contentHash · **L2** author · **L3** publisher/store ·
**L4** evidence. The method reserves a runtime-attestation vocabulary (§4.7)
for ecosystem alignment; it is vocabulary reservation only, no runtime
behavior is defined.

## Reference implementation

A zero-dependency reference implementation of this method exists and is
maintained separately (identity core + service modules). This repository
publishes the **specification and normative documents**; endpoint semantics
are described below for interoperability.

The reference registry is deployed at **compliancehub.cn** (HTTPS):

- discovery: `https://compliancehub.cn/.well-known/cha2a`
- resolve: `https://compliancehub.cn/api/v1/did/<did>`
- trust lookup: `https://compliancehub.cn/api/v1/trust/query?did=<did>`
- trust proof: `https://compliancehub.cn/api/v1/trust/proof?did=<did>`
- badge: `https://compliancehub.cn/badge/<type>/<id>`
- evidence: `https://compliancehub.cn/api/v1/evidence/query?did=<did>`

## Endpoint semantics

- `POST /api/v1/register` — Create: assigns `did:cha2a:<type>:<id>`
- `GET  /api/v1/did/<did>` — Read: returns a W3C DID Document (JSON-LD)
- `GET  /.well-known/cha2a` — discovery (publicKeys + supportedMethods)
- `GET  /api/v1/trust/proof?did=..` — signed trust proof (Ed25519)
- `GET  /api/v1/trust/query?did=.. | ?type=&name=` — trust lookup + certification level (L0-L4)
- `GET  /badge/<type>/<id>` — SVG trust badge (level-colored; red when revoked)
- `POST /api/v1/trust/revoke` / `GET /api/v1/trust/revocations` — trust revocation
- `POST /api/v1/deactivate` — deactivate resource (suspended/revoked/deprecated)
- error semantics: 400 (syntax), 404 (not found), 409 (duplicate/conflict)

## Try it

Register a sample resource against the public reference instance:

```sh
curl -X POST https://compliancehub.cn/api/v1/register \
  -H 'Content-Type: application/json' \
  -d '{"type":"skill","id":"demo-skill","metadata":{"name":"demo"}}'

curl -s "https://compliancehub.cn/api/v1/trust/query?did=did:cha2a:skill:demo-skill"
```

## License

Apache License 2.0. See [LICENSE](./LICENSE).
