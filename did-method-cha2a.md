# CHA2A — Agent Identity & Source Attestation Framework

## The `did:cha2a` DID Method Specification

**Version:** 1.0
**Status:** Draft — not yet registered in the W3C DID Extensions registry; reference implementation live at compliancehub.cn
**License:** Apache License, Version 2.0
**Editor:** wwumit (complianceHub)
**Repository:** <https://github.com/wwumit/did-method-cha2a>
**Abstract:** This specification defines the `did:cha2a` Decentralized Identifier method. The method name is pronounced "CH-A2A": the prefix `ch` is an abbreviation for **complianceHub**, and `a2a` denotes agent-to-agent. A `did:cha2a` identifier names a resource — a publisher, an authority, an agent, a skill, an MCP server, an AI tool, an LLM, or the registry itself — registered in a cha2a Registry. Resolution returns a W3C DID Document whose verification material is the Registry's Ed25519 signing key and whose service endpoints expose trust lookup, signed trust proofs, and trust badges.

**Structure note:** This specification is self-authored and licensed under Apache-2.0. Its section organization follows the common structure required of DID method specifications (syntax, operations, DID Document structure, security/privacy considerations). All normative content herein is original to this specification.

---

## 1. Introduction

The `did:cha2a` method serves an open ecosystem for agent-to-agent identity and source attestation. Its core component, a cha2a Registry, catalogues software resources that participate in agent-to-agent and human-to-agent interactions: skills, MCP servers, AI tools, LLMs, autonomous agents, and the publishers and authorities that vouch for them. Each catalogued resource is assigned a DID of the form `did:cha2a:<resource-type>:<resource-id>`.

The `a2a` in the method name reflects that the method serves agent-to-agent interaction: beyond attesting skills and packages for human or agent use, `did:cha2a:agent` identifiers let agents mutually authenticate, discover capabilities, delegate work, and audit — a trust substrate for agent interconnection.

The method is **registry-mediated**: resolving a `did:cha2a` DID returns a W3C DID Document whose verification key is the Registry's Ed25519 signing key. The trust model is explicit and stated honestly: a verifier trusts a `did:cha2a` DID exactly as much as it trusts the Registry resolver it was configured with. This design follows the standard registry-mediated trust model (a verifier trusts its configured resolver); this specification is an independent registration in name, specification, and implementation.

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
did:cha2a:skill:skill-example
did:cha2a:agent:compliancehub.cn:agents:001
did:cha2a:agent:agent_conformance_test_001#key-1
did:cha2a:publisher:example-marketplace.com
```

### 1.2 Registry-mediated model and federation

Registry-mediated DID methods share a common technical model: a registry assigns the DID, holds the controller signing key, and resolves DID Documents over HTTP. `did:cha2a` is an **independent registration** within this model — with its own name, specification, and reference implementation, deployed domestically at compliancehub.cn. Its resource-type set (§3.2) is defined by this specification for interoperability. This method neither requires nor forbids interoperation with other registries; federation is specified minimally in §4.2.1 (permission model) and §7.5 (operational requirements).

### 1.3 Relationship to A2A and ARD ecosystems

The did:cha2a method is designed to coexist with the A2A (Agent2Agent) protocol and Google's Agentic Resource Discovery (ARD) at different layers, not to replace them:

- **A2A Agent Cards** describe an agent's *capabilities* (skills, interfaces, modes). A did:cha2a identity anchors *who the agent is* and its trust state. An agent may expose an A2A Agent Card for capability discovery while carrying a did:cha2a DID as its identity/trust anchor; the DID Document's `service` endpoints (trust lookup, trust proofs) give A2A consumers a verifiable trust surface A2A itself does not define.
- **ARD trust manifests** are framework-agnostic by design (the ARD specification explicitly accepts "a DID method" as a structurally valid `trustManifest.identity` framework). A did:cha2a DID Document is a conforming trust manifest: its `verificationMethod` is the Registry's Ed25519 signing key, and its publisher-authority binding (§4.5.1 of ARD) aligns with the `<publisher>` domain of the discovery identifier. An ARD registry that inspects and verifies manifests per the declared framework can therefore verify did:cha2a-issued trust manifests under this method's own verification rules (§4.6).
- **This method neither requires nor depends on** A2A or ARD adoption; the relationship is optional interoperation, not coupling.
- **Capability search.** A registry MAY expose a read-only search endpoint (`GET /api/v1/search?q=`) over registered resources and their capability/description fields; capability labels SHOULD be short, human-searchable strings. This complements (does not replace) A2A Agent Card and ARD discovery for registry-side lookup.

## 2. Method Name

The method name that shall identify this DID method is: `cha2a`.

A DID that uses this method MUST begin with the following literal prefix: `did:cha2a:`. The prefix and the method name are **case-sensitive lowercase**; an uppercase variant is not a valid `did:cha2a` DID and MUST be rejected (see §3.4). All bytes are US-ASCII.

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

DID Core restricts the generic `method-specific-id` to `idchar` (no unescaped `/` or `@`). Because `did:cha2a` mirrors upstream package identifiers (e.g. scoped npm names), this specification intentionally admits `/` and `@` unescaped so a DID string is byte-identical to the upstream identifier it names (e.g. `@modelcontextprotocol/server-filesystem`). Consumers requiring strict generic-DID grammar MAY percent-encode; consumers within the cha2a ecosystem SHOULD accept the unescaped form. This deviation is deliberate and recorded here rather than left implicit.

### 3.2 Resource type registry

Registration governs *issuance*, not *resolution*: implementations MUST NOT reject a DID solely because the `resource-type` slot contains an unregistered value that otherwise conforms to the ABNF in §3.1. Implementations MAY return 404 Not Found if the Registry has no record of the named resource.

The following resource types are defined by this specification:

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

### 3.4 Identifier normalization

Implementations MUST treat the literal prefix `did:cha2a:` and the `resource-type` slot as
**case-sensitive lowercase**: a DID whose prefix or `resource-type` contains uppercase
characters is not a valid `did:cha2a` DID and MUST be rejected rather than normalized.

The `resource-id` slot is **case-preserving**. Resolvers and registries MUST NOT lowercase,
uppercase, or otherwise case-fold a `resource-id`, and MUST NOT perform Unicode
normalization on it. The `resource-id` is compared byte-for-byte; two `resource-id` values
that differ only in case denote **different** resources.

This requirement follows from §3.1.1: a `did:cha2a` DID string is byte-identical to the
upstream identifier it names, and several upstream ecosystems treat identifier case as
significant (for example GitHub repository paths such as `Microsoft/vscode`). Case-folding
would break the correspondence between a DID and the upstream artifact it attests to, and
would therefore undermine source attestation itself.

An input `resource-id` that is not already in the form used by its upstream ecosystem does
not denote that upstream resource. Registries SHOULD surface a warning at registration time
when a submitted `resource-id` differs from the canonical upstream form, but MUST NOT
rewrite it.

Resolution is byte-exact: a resolution request for a `did:cha2a` DID whose `resource-id`
differs in case from a registered resource MUST return the same response as for any
unregistered DID (404), and MUST NOT resolve to the case-differing resource.

## 4. Method Operations

A cha2a Registry exposes the DID method operations as HTTP API endpoints. The exact URL paths below are those served by the reference implementation (§8) and may differ for other deployments.

### 4.1 Create

A `did:cha2a` DID is created as a side effect of registering a resource. The Registry assigns the DID at registration time using the form `did:cha2a:<resource-type>:<resource-id>` and writes it into the registry record.

The Registry SHOULD reject a registration whose resulting DID would collide with an existing registered DID (byte-exact comparison on `resource-type` and `resource-id`, see §3.4; the two slots MUST NOT be case-folded).

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

Per §3.4, resolution is byte-exact: a request whose `resource-id` differs in case from a registered resource is treated as unregistered (`404 Not Found`) and MUST NOT be case-corrected to a registered resource.

Resolvers MAY cache successful resolutions per the `Cache-Control` header; resolvers SHOULD NOT cache 4xx responses.

#### 4.2.1 Federation

The method permits federation: more than one cha2a Registry deployment MAY exist, and each deployment MAY resolve any well-formed `did:cha2a` DID. Under federation the trust semantics do not change: whatever resolver a verifier is configured with is the trust anchor for the documents it returns. A federated deployment MUST NOT be assumed to trust or relay data to any other registry unless explicitly configured to do so.

A deployment that opts into federation MAY expose an explicit peer profile:

- `GET /api/v1/registry/status` — the registry DID, deployed capabilities, and the configured peer roster.
- `GET /api/v1/registry/peers` — the peer roster; peer mutation endpoints (POST/DELETE) MUST require administrative authorization (e.g. `X-Admin-Key`).
- `GET /api/v1/registry/trust/{did}?peer=<id>` — a trust lookup that resolves **locally first**; only when the DID is not registered locally MAY it forward to an explicitly configured peer. Forwarded lookups MUST be read-only, MUST fail closed (surface the source peer and the upstream status rather than fabricate a result), and MUST NOT implicitly peer with unknown registries.

A registry that implements this profile SHOULD advertise the `federation` capability and its `registryStatus` / `registryPeers` / `registryTrust` endpoints in its §5.2 discovery document.

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

### 4.6 Certification levels (L0-L4)

A certification level is a verifier-facing signal about a registered resource, determined by the **verifier's local policy** — never by issuer declaration alone and never by any mutual-recognition agreement between registries:

| Level | Meaning | Basis (per resource metadata) |
|---|---|---|
| L0 | unverified | no declaration (default) |
| L1 | integrity | content fingerprint (`contentIdentity`/`contentHash`) for content resources; `#agent-key` key anchoring (identity-anchor) for agents |
| L2 | source | L1 + author attribution |
| L3 | issuance | L2 + publisher/store attestation (e.g. a marketplace or verifier that reviewed the listing) |
| L4 | ecosystem | L3 + ≥2 independent verifiers (distinct verifier DIDs), each with a structured `verifiedBy` entry, + disclosure consistency |

**L4 multi-verification.** L4 requires at least two **independent** verifiers (distinct verifier DIDs), each recording a structured `verifiedBy` entry (`verifier` DID, `method`, `result`, `at`, `evidenceRef`). Cross-verification is **invitation-based**: verifier A invites verifier B to independently re-verify; both entries are required and each references an auditable evidence store. A single entity acting under two identities does not satisfy independence. L4 therefore reflects an invitation-based consensus of multiple verifiers, not a unilateral declaration.

**Verifier registration validity (hard requirement).** Every `verifiedBy` entry MUST reference a verifier DID that is actually registered and resolvable in a Registry, and its `evidenceRef` MUST be a real, reachable URL to the auditable evidence store. Placeholder identifiers (e.g. unregistered names) or example/documentation URLs (e.g. RFC 2606 reserved domains) do not satisfy L4 — an implementation MUST NOT compute L4 from such entries. Until at least two real independent verifiers have each completed an auditable re-verification, no resource attains L4; L4 is a target state of the ecosystem, not a label derivable from verification-logic demonstration alone.

The framework aligns with national standard GB/Z 185 *Artificial Intelligence — Agent Interconnection* (identity code, identity management, agent description): CHA2A implements its mechanisms (credential lifecycle, identity authentication flow, delegation-chain verification, capability description) using DID as the cryptographic trust core, with the DID Document optionally declaring the national standard identity code mapping (`nationalStandardId`). Alignment is about mechanisms, not encoding: the OID identity code is a compliance label, DID is the trust executor — a mapping declaration satisfies the standard while runtime trust stays cryptographic.

A verifier decides which levels to accept by enumerating the publishers and attestations it trusts in its local policy — the same principle as verifying signatures against a configured resolver's key set. Whether one marketplace recognizes another marketplace's issuance is a local policy question, not a protocol-level interop agreement. Levels are computed from registered metadata; absence of a declaration yields L0, which is not a trust verdict but a statement that nothing has been attested yet.

**Verifier-as-publisher (explicit case).** A common deployment has a single entity acting as both verifier and L3 issuer (e.g. a store that verifies listings and publishes them under its own `publisher` DID). This is deliberate and consistent with local-policy verification: the meaning is "**this verifier's trusted set includes that publisher's signatures**", not "that publisher stamped the listing". Readers MUST NOT interpret an L3 badge as a third-party seal independent of the verifier's policy; implementations SHOULD expose which publisher signatures the local policy trusts alongside the displayed level.

### 4.7 Evidence credentials and verification

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

**Namespace unification.** `https://cha2a.org/predicate/` is the canonical predicate namespace for subject predicates. Attestation predicates (machine-readable verification evidence) follow the Evidence Record model (see below) and reference existing in-toto predicates where they exist (e.g. `https://in-toto.io/attestation/test-result/v0.1`, `https://in-toto.io/attestation/vuln/v0.1`); extensions are defined under `https://cha2a.org/predicate/` with a `cha2a/*` marker. Business predicates are registered in this whitelist with the same canonical namespace — e.g. `payment-receipt` (a verifiable payment receipt issued by an agent-payment service, used as L2+ evidence of a completed transaction). Implementations deployed under an instance domain (e.g. `compliancehub.cn`) MAY additionally accept that domain's path form (`<instance-domain>/evidence/<name>`) as a compatibility alias for already-issued records; the normative URI is always `https://cha2a.org/predicate/<name>/v1`.

**Evidence Record structure (integrated with the evidence-record.md companion).** The registry stores a credential **summary** (subject + predicateType + verifier + result + checkedAt + evidenceRef), not full evidence. The full Evidence Record is an in-toto Attestation envelope: the Envelope is DSSE-signed by the verifier's key (signature = verifier identity, a registered `verifier` DID), and the Statement carries the subject and predicate details. `evidenceRef` is the URL of the auditable evidence store (in-toto `url` field usage). Conformance of the full structure is defined in the companion `evidence-record.md`; this section pins the registry-facing contract.
**Content integrity verification (artifact attestation).** For AI assets (package / skill / model / dataset — any artifact carrying a `contentIdentity`), the Registry MAY provide a content-integrity verification endpoint (`/verify/artifact`) that aggregates four checks into a single machine-readable report:

| Check | Basis | Pass condition |
|---|---|---|
| Content fingerprint (L1) | subject `contentIdentity` (or evidence `artifactDigest`) vs. provided current-content hash | exact digest match (SHA-256 or SHA-512; hex or base64 integrity format) |
| Issuance attestation (L3) | at least one evidence credential with predicate `content-integrity` (or in-toto attestation), verifier = issuer/endorser, `result: passed` | exists, verifier resolvable |
| Certification level | subject's `level` (L0-L4) | `level >= 1`; `>= 3` implies issuance attested |
| Revocation (fail-closed) | subject status / revocations | NOT revoked; registry unavailable = FAIL (fail-closed) |

- **New predicate** (extends §4.6 namespace): `content-integrity` (artifact, L1) — issuer/endorser attests the artifact's content fingerprint; MAY carry `artifactDigest` (anti-tamper binding).
- **Result**: `PASS` / `FAIL` + machine-readable basis (which evidence, who endorsed, level, revocation state) — actionable by consumers (agents, stores, hosts) without re-deriving trust.
- **Vocabulary alignment**: `contentIdentity` ("what is shipped", §3.2 / registry side) ↔ runtime `anchorId`/`anchorGeneration` ("what runs", reserved) — this section defines the registry-side verification semantics only; runtime-side semantics remain reserved (see mapping below).
- **Boundary**: the endpoint verifies content integrity as attested by the Registry; it does not itself scan content (scanning remains a store/host concern) and does not guarantee content quality — only "what is shipped is what was published / endorsed / not revoked".

### 4.8 Runtime attestation vocabulary (reserved)

The registry side attests "what is shipped is what was published" (L1 content fingerprint). A complementary runtime side attests "what runs is what was verified" (e.g. a host runtime binding a captured tool definition and a monotonic anchor generation at execution, as discussed in ecosystem proposals on ToolRuntime settlement anchors). To keep vocabulary aligned across proposals, this specification reserves the following mapping — it is vocabulary reservation only, no runtime behavior is defined here:

| CHA2A (registry side) | Runtime side (reserved) |
|---|---|
| `contentIdentity` (content fingerprint, "what is shipped") | `anchorId` / `anchorGeneration` (captured at execution, "what runs") |
| L1 integrity attestation | settlement before success publication |
| revocation / deactivation | generation monotonicity / disposal fail-closed |

**Verifier attribution.** When a host merely lists required anchor IDs (e.g. "require settlement against anchor X before publishing success"), the verifier of the anchor is the host's local policy — the same principle as §4.6 verifier-local policy. The runtime side attests "what runs matches the captured definition/generation"; whether that satisfies the host is a host-local decision. Implementations SHOULD expose which anchors the local policy trusts alongside any settlement result, mirroring the "trusted set" disclosure in §4.6.

Implementations MAY evolve runtime attestation later; this section pins the shared terms so ecosystem proposals do not develop separate dialects.

## 5. DID Document Structure

A `did:cha2a` DID Document is a JSON-LD document conforming to DID Core. The reference implementation produces documents of the following shape:

```json
{
  "@context": [
    "https://www.w3.org/ns/did/v1",
    "https://w3id.org/security/suites/ed25519-2020/v1"
  ],
  "id": "did:cha2a:skill:skill-example",
  "verificationMethod": [
    {
      "id": "did:cha2a:skill:skill-example#registry-key",
      "type": "Ed25519VerificationKey2020",
      "controller": "did:cha2a:registry:compliancehub.cn",
      "publicKeyMultibase": "z<base64url-encoded Ed25519 public key>"
    }
  ],
  "authentication": [
    "did:cha2a:skill:skill-example#registry-key"
  ],
  "assertionMethod": [
    "did:cha2a:skill:skill-example#registry-key"
  ],
  "service": [
    {
      "id": "did:cha2a:skill:skill-example#trust-lookup",
      "type": "TrustLookup",
      "serviceEndpoint": "https://registry.example.com/api/v1/trust/query?type=skill&name=skill-example"
    },
    {
      "id": "did:cha2a:skill:skill-example#trust-proof",
      "type": "TrustProof",
      "serviceEndpoint": "https://registry.example.com/api/v1/trust/proof?did=did%3Acha2a%3Askill%3Askill-example"
    },
    {
      "id": "did:cha2a:skill:skill-example#badge",
      "type": "TrustBadge",
      "serviceEndpoint": "https://registry.example.com/badge/skill/skill-example"
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
    "trustProof": "/api/v1/trust/proof",
    "registryStatus": "/api/v1/registry/status",
    "registryPeers": "/api/v1/registry/peers",
    "registryTrust": "/api/v1/registry/trust/{did}"
  },
  "publicKeys": [
    { "version": 1, "algorithm": "Ed25519", "publicKey": "<base64>", "status": "signing", "createdAt": "<ISO-8601>" }
  ],
  "registryDid": "did:cha2a:registry:compliancehub.cn",
  "supportedMethods": ["did:cha2a"],
  "version": "1.0"
}
```

When a registry implements the §4.2.1 federation peer profile, it SHOULD additionally advertise `federation` in `capabilities` and include `registryStatus`, `registryPeers`, and `registryTrust` in `endpoints`.

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

A federated deployment MUST NOT relay data to another registry unless explicitly configured to do so; operators SHOULD document any cross-registry data flow. Implementations that expose the §4.2.1 peer profile MUST resolve trust lookups locally first and forward only to explicitly configured peers; forwarded lookups are read-only and MUST fail closed — they MUST surface the source peer and the upstream result rather than fabricate one. Registries MUST NOT automatically discover or trust peers; peering is an explicit administrative action. Cross-registry number resolution (phone resolve) MAY forward through a configured peer and MUST preserve the relaying identity as the observable sender (§3.2 relay delivery).

## 8. Reference Implementations

- **cha2a Registry (reference, running).** The reference registry is live at **<https://compliancehub.cn>** (operated by the maintainer; HTTPS via the site's existing TLS). It implements the §4 operations (Create, Read, Update, Deactivate), the §5 DID Document structure, and the §5.2 discovery document. Public endpoints include `https://compliancehub.cn/.well-known/cha2a` (discovery), `https://compliancehub.cn/api/v1/did/<did>` (resolution), `https://compliancehub.cn/api/v1/trust/query?did=<did>` (trust lookup), `https://compliancehub.cn/badge/<type>/<id>` (badge), `https://compliancehub.cn/api/v1/search?q=<term>` (search), `https://compliancehub.cn/api/v1/verify/artifact` (content-integrity, POST), and `https://compliancehub.cn/api/v1/registry/status` (federation). The Node process listens on `127.0.0.1` only; nginx reverse-proxies the deployed API paths on port 443, reusing the site certificate, and no public port is opened. Service endpoints advertised in `/.well-known/cha2a` are limited to the capabilities actually deployed (DID resolution; trust lookup, proof, and revocation; deactivation; evidence register/query; phone register/resolve/lookup; search; and the §4.2.1 federation peer profile — status/peers/trust); capabilities not deployed are not advertised. Conformance is demonstrated with byte-stable test vectors (self-published, `MANIFEST.sha256`-pinned).
- **Verifier tooling.** A local verifier (Ed25519) validating DID Documents and signed trust proofs against discovery `publicKeys`.

## 9. Conformance

This section defines how conformance to this specification is demonstrated and declared, following the established pattern of DID method conformance suites (byte-stable fixtures pinned by SHA-256, verified by SDK-independent reference verifiers, with a `MANIFEST.sha256`).

### 9.1 Conformance statement

An implementation MAY declare conformance to this specification (or a stated subset). The reference registry (§8) declares conformance to the full set below, evidenced by §8's recorded verification and the conformance assets described in §9.2–9.3.

### 9.2 Test coverage and vectors

Conformance is demonstrated over the following normative surface, each item with byte-stable test vectors (JSON fixtures, SHA-256-pinned in `MANIFEST.sha256`, with expected verdicts ACCEPT/REJECT) and at least one SDK-independent reference verifier:

| Normative surface | Covered requirements |
|---|---|
| DID syntax & normalization | §3.1 ABNF, §3.3 normalization, §3.4 reserved identifiers |
| CRUD operations | §4.1 Create, §4.2 Read (Resolve), §4.3 Update, §4.4 Deactivate |
| Outbound caller authentication | §4.5 (X-DID / X-DID-Sig verification) |
| Certification levels & evidence | §4.6 L0-L4 computation, evidence credential schema, revocation fail-closed |
| Federation peer profile (v0.4) | §4.2.1 trust-lookup semantics: local-first, explicit-peer forward only, fail-closed (no implicit peering, no fabricated results) |
| Content integrity verification | §4.7 artifact-attestation four-check aggregation (content fingerprint / issuance attestation / level / revocation fail-closed) |
| DID Document structure | §5 (verificationMethod, verification relationships, service endpoints, discovery document §5.2) |
| Signature verification | Ed25519 verification of registry-issued trust proofs against discovery `publicKeys` |

### 9.3 Live-endpoint conformance

In addition to fixtures, conformance SHOULD be demonstrated against a *running* deployment: scripts exercising the live endpoints (discovery `/.well-known/cha2a`, DID resolution, trust lookup, trust proof, revocation). The reference registry passes these for the endpoints it exposes (§8).

### 9.4 Not covered (honest)

The following are explicitly out of the conformance suite's coverage until further notice:

- **L4 ecosystem state**: requires ≥2 *independent* real verifiers with auditable re-verification (§4.6) — not provable by fixtures alone; tracked as a target ecosystem state, not a fixture verdict.
- **Federation across real registries**: v0.4 specifies the peer profile minimally (§4.2.1 + §7.5); its offline semantics (local-first, explicit-peer forward, fail-closed) are covered by conformance vectors, but interoperation between two real deployments is not yet verified (no second live registry).
- **Runtime attestation vocabulary** (§4.8): the runtime-side vocabulary is reserved, no runtime behavior defined; the registry-side content-integrity checks (§4.7) are covered by conformance vectors.

### 9.5 Conformance assets

The conformance suite (fixtures, reference verifiers, `MANIFEST.sha256`) is published in the companion repository **`cha2a-conformance`** (byte-stable fixtures, SHA-256-pinned in `MANIFEST.sha256`, judged by two SDK-independent reference verifiers — Python and Node — with parity interlock). **Current status: 68 fixtures (incl. §4.2.1 federation semantics and §4.7 content-integrity four-check vectors) judged 68/68 PASS by both verifiers; live checks against the running reference registry pass for the endpoints it exposes (§8); negative-vector ratio >1/3; CI enforces manifest pinning, count anti-drift, cross-repo version consistency, and reverse coverage of normative blocks.** Implementations claiming conformance MUST publish or reference their own vectors for any subset they claim beyond what this suite provides.

## 10. Versioning and Change Process

Revisions to this specification are recorded in the repository's `CHANGELOG.md`. Substantive changes (changes to the ABNF, the registered resource types, the operation surface, the DID Document shape, or the security model) SHALL be accompanied by a version bump and a pull request that requires review by the editor(s) listed in `MAINTAINERS.md` and a **1-day quiet period** before merge (reduced from 7 days in v0.2 and from 3 days in v0.3: the maintainer is the sole editor — self-review — so the quiet period serves as a cooling-off / community-notice window rather than an external-review dependency; public discussion continues indefinitely via the proposal thread). The quiet period is a **minimum gate, not a deadline**: any reviewer may request a longer period before merge.

Editorial changes (typos, links, wording) MAY merge without the quiet period.

## 11. Companion documents (specification group)

The did:cha2a specification is the normative method core. The following companion documents form the CHA2A specification group and are maintained alongside it:

- `evidence-record.md` — the machine-readable Evidence Record model (in-toto Attestation structure, DSSE signing, predicate registry), referenced by §4.6.
- `agent-identity.md` — the did:cha2a:agent identity protocol sub-specification (agent identity lifecycle, interaction scenarios, delegation/authorization scope), extending §3.2 and §4.5.
- `EVIDENCE.md` — recorded minimum-loop verification evidence (registration, discovery, resolution, signature verification).

Normative requirements appear only in this document; companion documents are informative unless explicitly referenced as normative by this specification.

## 12. References

- W3C Decentralized Identifiers (DIDs) v1.0: <https://www.w3.org/TR/did-core/>
- W3C DID Extensions registry: <https://github.com/w3c/did-extensions>
- DID Core `idchar` and verification relationships: <https://www.w3.org/TR/did-core/>

---

*v1.0. Editor: wwumit (complianceHub). License: Apache-2.0.*
