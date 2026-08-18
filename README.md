# did:cha2a — Registry (reference implementation)

A zero-dependency reference implementation of the `did:cha2a` DID method
(see the [method specification](../../CHA2A-DID-Method-规范草案-v0.1.md)).

`did:cha2a` is a registry-mediated identity method: `ch` abbreviates
**complianceHub**, `a2a` denotes agent-to-agent. A `did:cha2a` identifier names
a resource (publisher, authority, agent, skill, MCP server, AI tool, LLM, or
the registry itself) registered in a cha2a Registry.

## Status

Experimental. Zero dependencies (`node:crypto` + `node:http` only). Implements:

- `POST /api/v1/register` — Create: assigns `did:cha2a:<type>:<id>`
- `GET  /api/v1/did/<did>` — Read: returns a W3C DID Document (JSON-LD)
- `GET  /.well-known/cha2a` — discovery (publicKeys + supportedMethods)
- `GET  /api/v1/trust/proof?did=..` — signed trust proof (Ed25519)
- `GET  /api/v1/trust/query?did=.. | ?type=&name=` — trust lookup + certification level (L0-L4)
- `GET  /badge/<type>/<id>` — SVG trust badge (level-colored; red when revoked)
- `POST /api/v1/trust/revoke` / `GET /api/v1/trust/revocations` — trust revocation
- `POST /api/v1/deactivate` — deactivate resource (suspended/revoked/deprecated)
- error semantics: 400 (syntax), 404 (not found), 409 (duplicate/conflict)

Certification levels map the ecosystem proposal's annex C:
L0 none · L1 contentHash · L2 author · L3 publisher/store · L4 evidence.

## Run

```sh
node server.js            # listens on http://127.0.0.1:8787
```

Data is persisted under `./data/` (Ed25519 keypair + registry records).
The Ed25519 keypair is generated on first run and never leaves the instance.

## Public reference instance

The reference registry is deployed at **compliancehub.cn** (HTTPS):

- discovery: `https://compliancehub.cn/.well-known/cha2a`
- resolve: `https://compliancehub.cn/api/v1/did/<did>`
- trust lookup: `https://compliancehub.cn/api/v1/trust/query?did=<did>`
- badge: `https://compliancehub.cn/badge/<type>/<id>`

Deployment: Node listens on `127.0.0.1:8787` only; nginx (port 443) reverse-proxies
the four paths above, reusing the site's existing TLS certificate. No public port
is opened and existing services are unaffected.

## Verify

```sh
# issue a proof for a registered DID and verify it against the discovery key
node verify.js did:cha2a:skill:skill-compliance
```

The verifier fetches the discovery document over HTTP and validates the
signature against the advertised public key — it never touches the private key
and makes no external network requests (see `EVIDENCE.md`).

## Register sample resources

```sh
curl -X POST http://127.0.0.1:8787/api/v1/register \
  -H 'Content-Type: application/json' \
  -d '{"type":"publisher","id":"compliancehub.cn","metadata":{"name":"complianceHub"}}'

curl -X POST http://127.0.0.1:8787/api/v1/register \
  -H 'Content-Type: application/json' \
  -d '{"type":"skill","id":"skill-compliance","metadata":{"name":"skill-compliance","author":"wwumit"}}'
```

## License

Apache License 2.0. See [LICENSE](./LICENSE).
