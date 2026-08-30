# CHA2A — Agent Identity & Source Attestation Framework

## The `did:cha2a` DID Method Specification

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

The `a2a` in the method name reflects that the method serves agent-to-agent interaction: beyond attesting skills and packages for human or agent use, `did:cha2a:agent` identifiers let agents mutually authenticate, discover capabilities, delegate work, and audit — a trust substrate for agent interconnection.

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
| `agent` | An autonomous agent (A2A or otherwise) registered with the Registry. The DID **subject** is the individual agent (an instance MAY register several agents, each independently addressable); the DID Document's **controller** is the owning instance, which holds the trust anchor (Ed25519 signing key) shared by its agents — intra-instance agents form one trust domain. In inter-instance interaction the DID Document serves mutual authentication, capability discovery, delegation, and audit (service endpoints + trust proofs + disclosure/evidence). The agent's `verificationMethod` also signs outbound calls (see §4.5), letting external services identify the caller. Sub-agents beneath an agent reuse the host runtime's parent-child mechanism and are not separate identifiers. |
| `package` | A bundle/plugin package (e.g. an npm bundle) containing one or more skills; the integrity and signing unit. A package record MAY reference its contained skills. |
| `skill` | A skill catalogued in the Registry, identified by its official required name. A skill MAY carry `contentIdentity` (SHA-256 of the skill content, for cross-package identity: the same content repackaged in another package shares the identity; modified content does not), an optional `derivedFrom` (upstream content hash for honest derivation), and a `bundle` reference to the owning package DID. |
| `mcp_server` | A Model Context Protocol server. |
| `ai_tool` | A generic AI tool catalogued in the Registry. |
| `llm` | An LLM endpoint or model catalogued in the Registry. |
| `org` | The **carrier layer** for agents: operates number ranges, reachability, relay delivery and inbox. An org is typically an enterprise, organization or individual that serves as the organizational-boundary entry point for agents. Number ranges are **authorized by the Registry** (see §3.3) — the Registry remains the neutral authority over numbers; an org is not the Registry itself. |
| `provider` | An **application-layer service provider (SP)**: delivers concrete application services (e.g. RCS messaging/groups) that agents attach to. An agent MAY attach multiple services across different orgs/providers (a "service-domain radiation" model: one identity, many service attachments). |
| `verifier` | An **independent verification entity** that performs and attests to checks on registered subjects. A verifier MUST be registered and resolvable to satisfy §4.6 (every `verifiedBy` entry references a registered verifier DID). Optional capability declarations and verification history are carried in metadata. |

Additions to this table are made by pull request against this repository.

### 3.3 Service attachment and number-range grant

An agent record MAY carry a `metadata.services` array with two element shapes:

1. **String** — a plain capability label (e.g. `"telephony"`). No reference, no validation; any org/agent MAY declare capabilities this way.
2. **Object** — an attachment to a concrete org or provider:
   - `{ "type": "telephony", "org": "did:cha2a:org:<id>", "number": "+86..." }`
   - `{ "type": "messaging", "sp": "did:cha2a:provider:<id>" }`

Validation rules (MUST, enforced on both register and update):
- An object entry MUST reference a **registered** org/provider DID (dangling references are rejected).
- An entry that attaches an `org` AND carries a `number` MUST have that number fall within one of the org's **granted number ranges** — numbers belong to the Registry, ranges are authorized to orgs.
- A provider-only entry's number (if any) is NOT range-checked (providers do not operate numbers; left as an extension point).

Numbers are a Registry asset: the Registry is the neutral authority over number ownership, and authorizes ranges to orgs for operation.
- `POST /api/v1/number-range/grant` — Registry issues a `number-range` grant to an org: request `{ "grantee": "did:cha2a:org:<id>", "range": "+86138" }` (international prefix form). Administrative operation (X-Admin-Key); disabled (503) when no admin key is configured. Rejected when: grantee is not an org, org not registered, malformed range, duplicate active grant (409).
- `GET /api/v1/number-ranges?grantee=<did>` — public lookup of an org's granted ranges (the number authority is publicly auditable).

The grant record is a first-class predicate (`number-range-grant`), usable as L2+ carrier evidence in the trust model.

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

### 4.5 Caller authentication (outbound calls)

When a skill or agent calls an external service (a SaaS API, an MCP server, a billing endpoint), the external service identifies the caller via request-bound DID signatures. The caller's `verificationMethod` (the agent DID's key) is used for request signing, not only for trust proofs:

```
X-DID:       <did:cha2a:agent:...>   ; caller identity (subject = agent)
X-DID-Sig:   <Ed25519 signature>     ; over method + params + timestamp + nonce
X-DID-TS:    <ISO-8601 timestamp>
X-DID-Nonce: <random value>
```

The signature input MUST bind the request (method, parameters, timestamp, nonce) to prevent tampering and replay; a bare identity claim without a request-bound signature is not sufficient. An external service verifies in three steps using only the discovery public key (no registry integration required): (1) resolve the DID to its DID Document, (2) verify the signature against the document's `verificationMethod`, (3) optionally consult the caller's certification level (L0-L4) for differentiated authorization. API keys, when present, remain the channel credential; the DID signature is the caller identity — the two layers coexist.

**Agent self-held key (`#agent-key`).** An agent MAY register its own Ed25519 public key (private key never leaves the agent's device) via `POST /api/v1/agent/key/register` (the agent DID must already be registered). The DID Document then exposes an additional verification method `#agent-key` with **controller = the agent DID itself**, alongside the default `#registry-key` (controller = the Registry). `#agent-key` is **appended, never replacing** `#registry-key`. Signatures by `#agent-key` attest "this agent is speaking" (self-attestation), not merely "the Registry has a record for this agent"; external services MAY prefer `#agent-key` for outbound-call identity (§4.5) when present. The agent-key serves as identity-anchor evidence (L1 subject attestation, §4.6).

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

A DID Document MAY carry an optional `nationalStandardId` property declaring the national standard identity code (GB/Z 185.2 OID) of the subject, for compliance mapping; presence of the field with a valid code satisfies the national-standard identity-code requirement, while cryptographic verification always uses the `verificationMethod` keys.

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

### 4.6 Certification levels (L0-L4)

A certification level is a verifier-facing signal about a registered resource, determined by the **verifier's local policy** — never by issuer declaration alone and never by any mutual-recognition agreement between registries:

| Level | Meaning | Basis (per resource metadata) |
|---|---|---|
| L0 | unverified | no declaration (default) |
| L1 | integrity | content fingerprint (contentIdentity/contentHash) |
| L2 | source | L1 + author attribution |
| L3 | issuance | L2 + publisher/store attestation (e.g. a marketplace or verifier that reviewed the listing) |
| L4 | ecosystem | L3 + ≥2 independent verifiers (distinct verifier DIDs), each with a structured `verifiedBy` entry, + disclosure consistency |

**L4 multi-verification.** L4 requires at least two **independent** verifiers (distinct verifier DIDs), each recording a structured `verifiedBy` entry (`verifier` DID, `method`, `result`, `at`, `evidenceRef`). Cross-verification is **invitation-based**: verifier A invites verifier B to independently re-verify; both entries are required and each references an auditable evidence store. A single entity acting under two identities does not satisfy independence. L4 therefore reflects an invitation-based consensus of multiple verifiers, not a unilateral declaration.

**Verifier registration validity (hard requirement).** Every `verifiedBy` entry MUST reference a verifier DID that is actually registered and resolvable in a Registry, and its `evidenceRef` MUST be a real, reachable URL to the auditable evidence store. Placeholder identifiers (e.g. unregistered names) or example/documentation URLs (e.g. RFC 2606 reserved domains) do not satisfy L4 — an implementation MUST NOT compute L4 from such entries. Until at least two real independent verifiers have each completed an auditable re-verification, no resource attains L4; L4 is a target state of the ecosystem, not a label derivable from verification-logic demonstration alone.

The framework aligns with national standard GB/Z 185 *Artificial Intelligence — Agent Interconnection* (identity code, identity management, agent description): CHA2A implements its mechanisms (credential lifecycle, identity authentication flow, delegation-chain verification, capability description) using DID as the cryptographic trust core, with the DID Document optionally declaring the national standard identity code mapping (`nationalStandardId`). Alignment is about mechanisms, not encoding: the OID identity code is a compliance label, DID is the trust executor — a mapping declaration satisfies the standard while runtime trust stays cryptographic.

A verifier decides which levels to accept by enumerating the publishers and attestations it trusts in its local policy — the same principle as verifying signatures against a configured resolver's key set. Whether one marketplace recognizes another marketplace's issuance is a local policy question, not a protocol-level interop agreement. Levels are computed from registered metadata; absence of a declaration yields L0, which is not a trust verdict but a statement that nothing has been attested yet.

**Verifier-as-publisher (explicit case).** A common deployment has a single entity acting as both verifier and L3 issuer (e.g. a store that verifies listings and publishes them under its own `publisher` DID). This is deliberate and consistent with local-policy verification: the meaning is "**this verifier's trusted set includes that publisher's signatures**", not "that publisher stamped the listing". Readers MUST NOT interpret an L3 badge as a third-party seal independent of the verifier's policy; implementations SHOULD expose which publisher signatures the local policy trusts alongside the displayed level.

### 4.7 Runtime attestation vocabulary (reserved)
#### Evidence credentials, verification status, and predicate namespace

**Evidence credential.** A verifier's predicate-level check on a subject is recorded as an evidence credential:

| Field | Description |
|---|---|
| `subject` | did:cha2a DID of the verified subject |
| `predicateType` | URI of the claimed predicate (see namespace below) |
| `verifier` | Registered verifier DID (hard requirement, above) |
| `result` | pass / fail / partial |
| `checkedAt` | ISO-8601 timestamp |
| `evidenceRef` | Real, reachable URL to the auditable evidence |
| `artifactDigest` | Optional SHA-256 digest binding the evidence artifact (anti-tamper) |

Credentials are predicate-scoped by subject type: `identity-anchor` / `owner-binding` / `number-binding` / `delegation` → agent; `number-range-grant` → org; in-toto/attestation → artifacts (package/skill). Predicate-subject mismatches are rejected.

**Principal verification status.** Trust lookups SHOULD report the subject's verification status (aligned with ARIA verificationStatus):

- `self-declared` — subject's own declarations only (metadata); default for L0/L1.
- `registry-confirmed` — Registry-issued or verified evidence exists (key registration, number-range grants, owner/number bindings); basis for L2+.
- `legal-verified` — legal-entity verification; reserved for commercial phases, not yet produced.

Status is orthogonal to level: level says how strong the evidence is; status says whether it was self-declared or confirmed.

**Predicate namespace.** Cha2a subject predicates use `https://cha2a.org/predicate/`:

- `identity-anchor` (agent, L1) — key anchoring: public key registered, private key device-held.
- `owner-binding` (agent, L2) — subject ↔ owner (org/person) binding, confirmed by a verifier.
- `number-binding` (agent, L2) — number ↔ agent binding.
- `number-range-grant` (org, L2+) — Registry-authorized number range.
- `delegation` (agent, L3) — endorsement/delegation chain.

Predicate URIs: `https://cha2a.org/predicate/<name>/v1`. Implementations MAY accept predicate keywords (short names) for compatibility; whitelist matching is by keyword (case-insensitive contains).



The registry side attests "what is shipped is what was published" (L1 content fingerprint). A complementary runtime side attests "what runs is what was verified" (e.g. a host runtime binding a captured tool definition and a monotonic anchor generation at execution, as discussed in ecosystem proposals on ToolRuntime settlement anchors). To keep vocabulary aligned across proposals, this specification reserves the following mapping — it is vocabulary reservation only, no runtime behavior is defined here:

| CHA2A (registry side) | Runtime side (reserved) |
|---|---|
| `contentIdentity` (content fingerprint, "what is shipped") | `anchorId` / `anchorGeneration` (captured at execution, "what runs") |
| L1 integrity attestation | settlement before success publication |
| revocation / deactivation | generation monotonicity / disposal fail-closed |

**Verifier attribution.** When a host merely lists required anchor IDs (e.g. "require settlement against anchor X before publishing success"), the verifier of the anchor is the host's local policy — the same principle as §4.6 verifier-local policy. The runtime side attests "what runs matches the captured definition/generation"; whether that satisfies the host is a host-local decision. Implementations SHOULD expose which anchors the local policy trusts alongside any settlement result, mirroring the "trusted set" disclosure in §4.6.

Implementations MAY evolve runtime attestation later; this section pins the shared terms so ecosystem proposals do not develop separate dialects.

## 6. Security Considerations

### 6.1 Registry-mediated trust

The method is not fully decentralized in the sense of `did:key` or `did:peer`. A verifier's trust in a resolved DID is exactly its trust in the configured Registry resolver. This is stated honestly; deployments SHOULD document their resolver choice.

### 6.2 Key rotation

Rotation MUST create an explicit overlap period and advertise all valid keys in the discovery document; verifiers MUST NOT hardcode a single key. DID Documents SHOULD declare `rotationKeys` and `nextUpdate` so a controller update immediately invalidates the prior key version.

### 6.3 Revocation propagation

After a revocation, resolvers and caches MUST invalidate within a bounded, documented TTL so that an L2+ badge turns red within an acceptable window — revocation must be a hard propagation requirement, not a post-hoc discovery. Caches SHOULD NOT serve 4xx results.

### 6.4 Credential lifecycle

Signed attestations (trust proofs) are treated as agent credentials with a lifecycle: issuance (credential issuer), use (presentation during authentication), update, and revocation. Revocation MUST propagate within the bounded TTL (§4.6); credentials SHOULD carry type and validity metadata.

### 6.5 Delegation-chain verification

Delegation is chain-aware: each hop (delegator → delegated agent) carries a delegation credential with the delegator, authorization scope, and a chain reference; a verifier MUST validate each hop's authorization along the chain (aligned with GB/Z 185.3 delegation-chain verification).

### 6.6 Fail-closed verification

Registry unavailability (network error, timeout, error response) MUST be treated as **rejection**, never acceptance: the claim is NOT considered valid and the subject MUST NOT be presented as trusted. Bare identity claims without a verifiable signature or resolvable trust state are insufficient for trust decisions. This aligns with the ARIA/MolTrust fail-closed principle: trust decisions require positive confirmation; absence of confirmation is denial.

### 6.7 Revocation checking in verification flows

A consumer (UI, relay, or external verifier) presenting trust information about a subject MUST surface revocation state: resolve/trust lookups include revocation state (`revoked`, `active`, `suspicious`), and consumers MUST display or act on it — a revoked or inactive subject MUST NOT be presented as trusted. This is the consumer-side counterpart of §4.4.1.

### 6.8 Transparency log

Product signatures SHOULD go through a public transparency log (e.g. Sigstore/Rekor) so the signing time of an artifact is auditable and a compromised key's affected window can be reconstructed.

### 6.9 Compromise of Registry signing key

If the Registry's Ed25519 key is compromised, all DIDs resolved by that Registry are affected. Deployments SHOULD support key revocation and rotation procedures and publish an incident/advisory channel in the discovery document (`advisory-feed` capability).

### 6.10 Delegation boundaries

A Registry-issued signature attests to the Registry's registration record for the subject, not to the subject's runtime behavior. Trust proofs and badges attest to registered metadata; runtime authorization decisions require additional evidence.

### 6.11 Post-quantum considerations

Deployments MAY additionally publish a hybrid post-quantum public key in the discovery document (e.g. ML-DSA) alongside Ed25519; verifiers SHOULD accept either for now, and MUST NOT treat the presence of a PQC key as mandatory until the ecosystem standardizes on it.

## 7. Privacy Considerations

### 7.1 Public registry records

Registered resource metadata (name, description, publisher, timestamps) is public by design; publishers SHOULD NOT include personal data beyond what is necessary.

### 7.2 Resolution traffic

Resolution endpoints MAY observe query patterns; operators SHOULD treat resolution logs as sensitive and apply retention limits.

### 7.3 Bundle download

A `package`/`skill` bundle is a signed, public artifact; its download endpoints MAY be observed. Operators SHOULD apply retention limits to download logs and MUST NOT include personal data beyond what is necessary in bundle metadata. Clients SHOULD fetch bundles over HTTPS and verify the package signature and, where applicable, `contentIdentity` (§3.2) before use.

### 7.4 Correlation across resources

Because a cha2a Registry resolves all of its own resources, resolution and trust-lookup traffic can correlate DIDs issued by the same Registry (e.g., agents sharing a controller, or publisher/org/provider resources). Operators SHOULD document this correlation risk, avoid cross-resource data flows beyond what is configured, and treat correlation-enabling logs under the same retention policy as resolution logs (§7.2). Publishers SHOULD avoid placing correlatable non-essential metadata in the registry.

### 7.5 Federation

A federated deployment MUST NOT relay data to other registries unless explicitly configured; operators SHOULD document any cross-registry data flow.

## 8. Reference Implementations

- **cha2a Registry (reference, running).** The reference registry is live at **<https://compliancehub.cn>** (operated by the maintainer; HTTPS via the site's existing TLS). It implements the §4 operations (Create, Read, Update, Deactivate), the §5 DID Document structure, and the §5.2 discovery document. Public endpoints: `https://compliancehub.cn/.well-known/cha2a` (discovery), `https://compliancehub.cn/api/v1/did/<did>` (resolution), `https://compliancehub.cn/api/v1/trust/query?did=<did>` (trust lookup), `https://compliancehub.cn/badge/<type>/<id>` (badge). The Node process listens on `127.0.0.1` only; nginx reverse-proxies the four paths on port 443, reusing the site certificate, and no public port is opened. Service endpoints advertised in resolved DID Documents and in `/.well-known/cha2a` are limited to the capabilities actually deployed — DID resolution, trust lookup, trust proof issuance, revocation, and deactivation; capabilities not deployed (e.g. federation sync) are not advertised. Conformance is demonstrated with byte-stable test vectors (self-published, `MANIFEST.sha256`-pinned) and, where applicable, cross-checked against the conformance fixtures of interoperable registry-mediated methods.
- **Verifier tooling.** A local verifier (Ed25519) validating DID Documents and signed trust proofs against discovery `publicKeys`.

## 9. Versioning and Change Process

Revisions to this specification are recorded in the repository's `CHANGELOG.md`. Substantive changes (changes to the ABNF, the registered resource types, the operation surface, the DID Document shape, or the security model) SHALL be accompanied by a version bump and a pull request that requires review by the editor(s) listed in `MAINTAINERS.md` and a **3-day quiet period** before merge (reduced from 7 days in v0.2: the maintainer is the sole editor — self-review — so the quiet period serves as a cooling-off / community-notice window rather than an external-review dependency; public discussion continues indefinitely via the proposal thread, 3 days is the merge gate only).

Editorial changes (typos, links, wording) MAY merge without the quiet period.

## 10. References

- W3C Decentralized Identifiers (DIDs) v1.0: <https://www.w3.org/TR/did-core/>
- W3C DID Extensions registry: <https://github.com/w3c/did-extensions>
- `did:opena2a` method specification (structure reference, Apache-2.0): <https://github.com/opena2a-standards/did-method-opena2a>
- DID Core `idchar` and verification relationships: <https://www.w3.org/TR/did-core/>

---

*Draft v0.1. Editor: wwumit (complianceHub). License: Apache-2.0.*
