# The `did:cha2a` DID Method Specification

**Version:** 0.1 (draft)
**Status:** Draft — not yet registered in the W3C DID Extensions registry; reference implementation live at compliancehub.cn
**License:** Apache License, Version 2.0
**Editor:** wwumit (complianceHub)
**Repository:** <https://github.com/wwumit/did-method-cha2a>
**Abstract:** This specification defines the `did:cha2a` Decentralized Identifier method. The method name is pronounced "CH-A2A": the prefix `ch` is an abbreviation for **complianceHub**, and `a2a` denotes agent-to-agent. A `did:cha2a` identifier names a resource — a publisher, an authority, an agent, a skill, an MCP server, an AI tool, an LLM, or the registry itself — registered in a cha2a Registry. Resolution returns a W3C DID Document whose verification material is the Registry's Ed25519 signing key and whose service endpoints expose trust lookup, signed trust proofs, and trust badges.

**Structure note:** This specification is self-authored. Its organization follows common DID method specification practice (syntax, operations, DID Document structure, security/privacy considerations) and is informed by the structure of `did:opena2a` (Apache-2.0); all normative content herein is original to this specification.

---

## 1. Introduction

The `did:cha2a` method serves an open ecosystem for agent-to-agent identity and source attestation. Its core component, a cha2a Registry, catalogues software resources that participate in agent-to-agent and human-to-agent interactions: skills, MCP servers, AI tools, LLMs, autonomous agents, and the publishers and authorities that vouch for them. Each catalogued resource is assigned a DID of the form `did:cha2a:<resource-type>:<resource-id>`.

The method is **registry-mediated**: resolving a `did:cha2a` DID returns a W3C DID Document whose verification key is the Registry's Ed25519 signing key. The trust model is explicit and stated honestly: a verifier trusts a `did:cha2a` DID exactly as much as it trusts the Registry resolver it was configured with. This design is deliberately identical in trust semantics to other registry-mediated methods, while remaining independent in name, specification, and implementation.

The method supports a four-layer identity model:

| Layer | cha2a resource type | Semantics |
|---|---|---|
| Distributor / store | `publisher` | Listing, review, commercial standing of a marketplace or store |
| Author / organization | `authority` | Creative/editorial attribution |
| Artifact | `skill` | Content fingerprint, integrity, provenance of a skill/plugin |
| Execution entity | `agent` | Subject trustworthiness, status, capabilities, evidence |

### 1.1 Examples

```
did:cha2a:registry:compliancehub.cn
did:cha2a:publisher:compliancehub.cn
did:cha2a:authority:compliancehub.cn
did:cha2a:skill:skill-compliance
did:cha2a:agent:compliancehub.cn:agents:001
did:cha2a:agent:agent_conformance_test_001#key-1
did:cha2a:publisher:example-marketplace.com
```

### 1.2 Relationship to other registry-mediated methods

Registry-mediated DID methods (a registry assigns the DID, holds the controller signing key, and resolves DID Documents over HTTP) form a small family. This method is an **independent registration**: it has its own name, specification, and reference implementation, deployed domestically at compliancehub.cn. The resource-type set (§3.2) follows the shared open convention of the family for interoperability; a verifier that trusts a resolver can resolve any well-formed DID of any registry-mediated method it is configured for. This method neither requires nor forbids interoperation with other registries; federation is out of scope for this specification (see §4.2.1).

## 2. Method Name

The method name that shall identify this DID method is: `cha2a`.

A DID that uses this method MUST begin with the following literal prefix: `did:cha2a:`. The prefix is normalized to lowercase. All bytes are US-ASCII.

**Naming note:** the prefix `ch` is an abbreviation for **complianceHub** (the maintainer's ecosystem and brand). The method name is stable and the definition is not tied to any other expansion.

## 3. Method-Specific Identifier

### 3.1 Syntax (ABNF)

```
cha2a-did         = "did:cha2a:" resource-type ":" resource-id [ "#" fragment ]
resource-type     = ALPHA-LOWER *( ALPHA-LOWER / "_" )
resource-id       = 1*( unreserved / ":" )
fragment          = 1*( unreserved )

ALPHA-LOWER       = %x61-7A          ; a-z
unreserved        = ALPHA / DIGIT / "." / "_" / "-" / "/" / "@"
ALPHA             = %x41-5A / %x61-7A
DIGIT             = %x30-39
```

A `resource-type` is a non-empty, lowercase ASCII alphabetic prefix that may contain underscores. A `resource-id` is one or more characters drawn from the `unreserved` set, with the colon (`:`) permitted to allow path-style identifiers used by upstream package ecosystems (e.g. scoped npm names, path-style agent and skill ids). The fragment component is optional and identifies a specific verification method or service endpoint within the DID Document (`#key-1`, `#trust-lookup`).

The `resource-type` rule is intentionally open. New resource types may be added over time without revising this specification (see §3.2).

### 3.1.1 Relationship to the DID Core `idchar` production

DID Core restricts the generic `method-specific-id` to `idchar` (no unescaped `/` or `@`). Like other registry-mediated methods that mirror upstream package identifiers, this specification intentionally admits `/` and `@` unescaped so a DID string is byte-identical to the upstream identifier it names (e.g. `@modelcontextprotocol/server-filesystem`). Consumers requiring strict generic-DID grammar MAY percent-encode; consumers within the cha2a ecosystem SHOULD accept the unescaped form. This deviation is deliberate and recorded here rather than left implicit.

### 3.2 Resource type registry

Registration governs *issuance*, not *resolution*: implementations MUST NOT reject a DID solely because the `resource-type` slot contains an unregistered value that otherwise conforms to the ABNF in §3.1. Implementations MAY return 404 Not Found if the Registry has no record of the named resource.

The following resource types are defined, aligned with the shared open convention of registry-mediated methods in the agent ecosystem (for interoperability):

| Resource type | Description |
|---|---|
| `registry` | A cha2a Registry instance itself. The reference registry is `did:cha2a:registry:compliancehub.cn`. |
| `authority` | A naming authority (typically a domain) recognized as a root or delegated trust anchor. |
| `publisher` | A vetted publisher of one or more catalogued resources. |
| `agent` | An autonomous agent (A2A or otherwise) registered with the Registry. |
| `package` | A bundle/plugin package (e.g. an npm bundle) containing one or more skills; the integrity and signing unit. A package record MAY reference its contained skills. |
| `skill` | A skill catalogued in the Registry, identified by its official required name. A skill MAY carry `contentIdentity` (SHA-256 of the skill content, for cross-package identity: the same content repackaged in another package shares the identity; modified content does not), an optional `derivedFrom` (upstream content hash for honest derivation), and a `bundle` reference to the owning package DID. |
| `mcp_server` | A Model Context Protocol server. |
| `ai_tool` | A generic AI tool catalogued in the Registry. |
| `llm` | An LLM endpoint or model catalogued in the Registry. |

Additions to this table are made by pull request against this repository.

## 4. Method Operations

A cha2a Registry exposes the DID method operations as HTTP API endpoints. The exact URL paths below are those served by the reference implementation (§8) and may differ for other deployments.

### 4.1 Create

A `did:cha2a` DID is created as a side effect of registering a resource. The Registry assigns the DID at registration time using the form `did:cha2a:<resource-type>:<resource-id>` and writes it into the registry record.

The Registry SHOULD reject a registration whose resulting DID would collide with an existing registered DID (case-sensitive comparison on `resource-type` and `resource-id` after normalization).

Resources are typically registered by an authenticated publisher submitting metadata through the Registry's registration endpoint, or by an ingestion pipeline from upstream registries (npm, PyPI, Hugging Face, GitHub) assigning a `did:cha2a:` identifier at admission time.

### 4.2 Read (Resolve)

A `did:cha2a` DID is resolved by issuing an HTTP `GET` request to the path `/api/v1/did/<did>` on a configured cha2a Registry resolver:

```
GET https://registry.example.com/api/v1/did/did:cha2a:registry:compliancehub.cn
```

The Registry replies with a W3C DID Document (see §5) and the following headers:

```
Content-Type:    application/did+ld+json
Cache-Control:   public, max-age=300
```

If the resource named by the DID is not registered, the Registry MUST reply `404 Not Found` with a JSON body of the form `{"error": "resource not found: <type>/<id>"}`. A DID that violates the §3.1 syntax MUST be answered with `400 Bad Request` and a JSON body naming the defect.

Resolvers MAY cache successful resolutions per the `Cache-Control` header; resolvers SHOULD NOT cache 4xx responses.

#### 4.2.1 Federation

The method permits federation: more than one cha2a Registry deployment MAY exist, and each deployment MAY resolve any well-formed `did:cha2a` DID. Under federation the trust semantics do not change: whatever resolver a verifier is configured with is the trust anchor for the documents it returns. A federated deployment MUST NOT be assumed to trust or relay data to any other registry unless explicitly configured to do so.

### 4.3 Update

1. **Resource metadata update.** A publisher may change the metadata of a resource they control through an authenticated Registry endpoint. The DID itself does not change; the `updated` field of the returned DID Document reflects the most recent metadata update.
2. **Signing key rotation.** The Registry's Ed25519 signing key — the controller key for every DID it resolves — is rotated through an internal endpoint. A rotation creates a new key version and an explicit overlap period (default seven days) during which both old and new keys are valid for verification. The Registry's `/.well-known/cha2a` discovery document lists all currently-valid signing keys in `publicKeys`.

Verifiers MUST consult the `publicKeys` array from `/.well-known/cha2a` (not a single hardcoded key) when verifying signatures against a `did:cha2a` DID. A signature is accepted when it verifies under any key that the discovery document currently lists as valid.

### 4.4 Deactivate

A `did:cha2a` DID is deactivated by transitioning the underlying resource record into a non-active status (`suspended`, `revoked`, or `deprecated`). After deactivation, resolution SHOULD report `deactivated: true` in `didDocumentMetadata` per DID Core §7.1.2, and the returned document SHOULD NOT advertise active service endpoints. A separate trust-proof revocation endpoint is used to revoke previously-issued signed trust proofs.

#### 4.4.1 Deactivation vs. credential revocation

Deactivation says the *subject* has been retired and is no longer a valid identifier. Credential revocation says a *specific signed assertion about a still-valid subject* has been revoked. A DID MAY be active while specific credentials issued for it are revoked, and a DID MAY be deactivated while previously-issued credentials remain technically verifiable. A verifier MUST NOT rely on a credential for any new authorization decision once its subject DID has been deactivated.

## 5. DID Document Structure

A `did:cha2a` DID Document is a JSON-LD document conforming to DID Core. The reference implementation produces documents of the following shape:

```json
{
  "@context": [
    "https://www.w3.org/ns/did/v1",
    "https://w3id.org/security/suites/ed25519-2020/v1"
  ],
  "id": "did:cha2a:skill:skill-compliance",
  "verificationMethod": [
    {
      "id": "did:cha2a:skill:skill-compliance#registry-key",
      "type": "Ed25519VerificationKey2020",
      "controller": "did:cha2a:registry:compliancehub.cn",
      "publicKeyMultibase": "z<base64url-encoded Ed25519 public key>"
    }
  ],
  "authentication": [
    "did:cha2a:skill:skill-compliance#registry-key"
  ],
  "assertionMethod": [
    "did:cha2a:skill:skill-compliance#registry-key"
  ],
  "service": [
    {
      "id": "did:cha2a:skill:skill-compliance#trust-lookup",
      "type": "TrustLookup",
      "serviceEndpoint": "https://registry.example.com/api/v1/trust/query?type=skill&name=skill-compliance"
    },
    {
      "id": "did:cha2a:skill:skill-compliance#trust-proof",
      "type": "TrustProof",
      "serviceEndpoint": "https://registry.example.com/api/v1/trust/proof?did=did%3Acha2a%3Askill%3Askill-compliance"
    },
    {
      "id": "did:cha2a:skill:skill-compliance#badge",
      "type": "TrustBadge",
      "serviceEndpoint": "https://registry.example.com/badge/skill/skill-compliance"
    }
  ],
  "created": "2026-08-18T00:00:00Z",
  "updated": "2026-08-18T00:00:00Z"
}
```

### 5.1 Verification relationships

Every `did:cha2a` DID Document SHALL bind its `verificationMethod` to a purpose through the DID Core verification relationships `authentication` and `assertionMethod`. Per DID Core, a verifier MUST NOT treat a key as valid for authentication or assertion unless the DID Document lists it under the corresponding relationship. The reference implementation binds the Registry's single signing key once and reuses it.

### 5.2 Discovery document

A cha2a Registry SHOULD expose a discovery document at `/.well-known/cha2a` advertising its capabilities, its currently-valid `publicKeys`, its own registry DID, and its `supportedMethods` array:

```json
{
  "capabilities": ["trust-proof", "federation", "advisory-feed", "revocation"],
  "endpoints": {
    "didResolve": "/api/v1/did/{did}",
    "trustLookup": "/api/v1/trust/query",
    "trustProof": "/api/v1/trust/proof"
  },
  "publicKeys": [
    { "version": 1, "algorithm": "Ed25519", "publicKey": "<base64>", "status": "signing", "createdAt": "<ISO-8601>" }
  ],
  "registryDid": "did:cha2a:registry:compliancehub.cn",
  "supportedMethods": ["did:cha2a"],
  "version": "1.0"
}
```

## 6. Security Considerations

- **Registry-mediated trust.** The method is not fully decentralized in the sense of `did:key` or `did:peer`. A verifier's trust in a resolved DID is exactly its trust in the configured Registry resolver. This is stated honestly; deployments SHOULD document their resolver choice.
- **Key rotation.** Rotation MUST create an explicit overlap period and advertise all valid keys in the discovery document; verifiers MUST NOT hardcode a single key.
- **Compromise of Registry signing key.** If the Registry's Ed25519 key is compromised, all DIDs resolved by that Registry are affected. Deployments SHOULD support key revocation and rotation procedures and publish an incident/advisory channel in the discovery document (`advisory-feed` capability).
- **Delegation boundaries.** A Registry-issued signature attests to the Registry's registration record for the subject, not to the subject's runtime behavior. Trust proofs and badges attest to registered metadata; runtime authorization decisions require additional evidence.
- **Post-quantum considerations.** Deployments MAY additionally publish a hybrid post-quantum public key in the discovery document (e.g. ML-DSA) alongside Ed25519; verifiers SHOULD accept either for now, and MUST NOT treat the presence of a PQC key as mandatory until the ecosystem standardizes on it.

## 7. Privacy Considerations

- **Public registry records.** Registered resource metadata (name, description, publisher, timestamps) is public by design; publishers SHOULD NOT include personal data beyond what is necessary.
- **Resolution traffic.** Resolution endpoints MAY observe query patterns; operators SHOULD treat resolution logs as sensitive and apply retention limits.
- **Federation.** A federated deployment MUST NOT relay data to other registries unless explicitly configured; operators SHOULD document any cross-registry data flow.

## 8. Reference Implementations

- **cha2a Registry (reference, running).** The reference registry is live at **<https://compliancehub.cn>** (operated by the maintainer; HTTPS via the site's existing TLS). It implements the §4 operations (Create, Read, Update, Deactivate), the §5 DID Document structure, and the §5.2 discovery document. Public endpoints: `https://compliancehub.cn/.well-known/cha2a` (discovery), `https://compliancehub.cn/api/v1/did/<did>` (resolution), `https://compliancehub.cn/api/v1/trust/query?did=<did>` (trust lookup), `https://compliancehub.cn/badge/<type>/<id>` (badge). The Node process listens on `127.0.0.1` only; nginx reverse-proxies the four paths on port 443, reusing the site certificate, and no public port is opened. Service endpoints advertised in resolved DID Documents and in `/.well-known/cha2a` are limited to the capabilities actually deployed — DID resolution, trust lookup, trust proof issuance, revocation, and deactivation; capabilities not deployed (e.g. federation sync) are not advertised. Conformance is demonstrated with byte-stable test vectors (self-published, `MANIFEST.sha256`-pinned) and, where applicable, cross-checked against the conformance fixtures of interoperable registry-mediated methods.
- **Verifier tooling.** A local verifier (Ed25519) validating DID Documents and signed trust proofs against discovery `publicKeys`.

## 9. Versioning and Change Process

Revisions to this specification are recorded in the repository's `CHANGELOG.md`. Substantive changes (changes to the ABNF, the registered resource types, the operation surface, the DID Document shape, or the security model) SHALL be accompanied by a version bump and a pull request that requires review by the editor(s) listed in `MAINTAINERS.md` and a 7-day quiet period before merge.

Editorial changes (typos, links, wording) MAY merge without the quiet period.

## 10. References

- W3C Decentralized Identifiers (DIDs) v1.0: <https://www.w3.org/TR/did-core/>
- W3C DID Extensions registry: <https://github.com/w3c/did-extensions>
- `did:opena2a` method specification (structure reference, Apache-2.0): <https://github.com/opena2a-standards/did-method-opena2a>
- DID Core `idchar` and verification relationships: <https://www.w3.org/TR/did-core/>

---

*Draft v0.1. Editor: wwumit (complianceHub). License: Apache-2.0.*
