# Changelog

## 1.1.0 — 2026-09-08 (response to did-extensions editor review; ABNF grammar change, minor bump)

- §4.1 Create rewritten: **Registration flow** (registration via an authenticated publisher endpoint or an upstream ingestion pipeline; collision rejection), **Key custody** (the Registry generates and holds `#registry-key` by default; an agent MAY optionally register a self-held `#agent-key` — public key only, never the private key; custody externally visible through `verificationMethod.controller`), **Registries and resolution routing** (the DID encodes no registry location — same rationale as `did:key`; the verifier-configured resolver is the trust anchor; multiple deployments self-advertise via §5.2 discovery; records not held locally follow §4.2.1 fail-closed).
- §3.1 ABNF fix: the DID syntax no longer includes a fragment; a new `cha2a-did-url` production is added (fragments are DID URL semantics, per DID Core). §1.1 examples updated accordingly.
- §1: new §1.4 Scope — explicit layering of the method core (§3–§5) from usage profiles (§3.3, §4.5–§4.8); ecosystem and compliance narratives moved out of the method specification into the companion documents.
- Usage-context narrative (region-specific identity-code alignment) moved from §4.6 into the `agent-identity.md` companion; §5.1 `nationalStandardId` description generalized (region-specific compliance identifier; semantics in the companion); an external document reference removed from §6.5.
- §6.2: removed the SHOULD referencing unregistered properties `rotationKeys`/`nextUpdate`; rotation state is expressed through §5.2 discovery `publicKeys[].version`/`createdAt` and the overlap window.
- §4.2: resolution example annotated (the host is the deployment host of the verifier-configured resolver, not information encoded in the DID).
- §4.3/§4.4: operation authority clarified (metadata updates and deactivation performed by the authenticated publisher or the Registry; the DID Document is produced and signed by the Registry as controller).
- §4.7: the predicate URI namespace is noted as an identifier namespace, not required to dereference.
- §8: reference-implementation section condensed; operational details (process topology, reverse proxy, TLS) marked as non-normative operational concerns.
- Wording: the `ch` etymology consolidated to a single place in §2; §1.2 "deployed domestically" → "deployed at compliancehub.cn"; §1 "four-layer model" → "principal layers" pointing to the full §3.2 resource-type set.
- §3.3 (service attachment and number-range grants) reduced to a semantic stub: attachment shapes, validation rules, and the grant API moved to `agent-identity.md` §6.5 (usage profiles live in the companions); the main specification keeps the semantic summary and the `number-range-grant` predicate anchor.
- §3.2 `org`/`provider` resource-type descriptions stripped of business narrative and compressed to minimal semantic definitions.
- §1.3: removed the "Capability search" bullet (a registry search feature is not an A2A/ARD relationship; deployment facts remain in §8).
- §4.7: the content-integrity endpoint given a scope statement (it introduces no new identity semantics — it aggregates existing §3.2/§4.6 facts; its contract is exercised by the §9.2 conformance suite).
- §4.8: removed an unexplained external-proposal reference (ToolRuntime); the runtime vocabulary mapping retained with deployment-neutral wording.
- §6.6: the fail-closed statement decoupled from external project names (ARIA/MolTrust); an external verificationStatus alignment note removed from §4.7.

- §4.7: fixed the evidence-credential `result` enum (`pass / fail / partial` → `passed / failed / partial`) to match the reference implementation and the §4.7 content-integrity table, which already used `passed`.
- §11: the `agent-identity.md` companion description updated to reflect its expanded role (§3.3 usage-profile material in its §6.5; `nationalStandardId` semantics in its appendix).

## 1.0.2 — 2026-09-04 (review baseline for W3C PR #744)

- Independent narrative: removed similarity phrasing ("family", "shared conventions", "same as other methods", "interoperable"); registry-mediated is described only as this method's own mechanism, without naming any specific method.

## 1.0 — 2026-09-04 (first frozen release; review baseline for W3C DID Extensions PR #744)

- §4.7 restructured: `Runtime attestation (reserved)` rebuilt as `Evidence credentials and verification` (evidence credential / predicate namespace / content-integrity checks placed in their proper section; the previously misplaced reserved block separated out); the genuine reserved vocabulary mapping moved to its own §4.8.
- §4.6 level table: L1 gains an agent-type basis (`#agent-key` identity-anchor).
- §5 DID Document example: neutral ids (`skill-example`); content-integrity draft-version markers removed.
- Structure note rewritten as the generic DID-method structure (syntax / operations / DID document / security / privacy), without naming any specific method.

## Unreleased (v0.4)

- §1.2: federation from "out of scope" → "specified minimally" (§4.2.1 + §7.5).
- §4.2.1: optional federation peer profile — registry/status, registry/peers (admin-gated mutation), registry/trust/{did} (local-first, read-only, fail-closed forward to explicitly configured peers only).
- §5.2: discovery document example + SHOULD advertise `federation` capability and `registryStatus`/`registryPeers`/`registryTrust` endpoints when the peer profile is deployed.
- §7.5: operational requirements — explicit-config relay only, local-first, read-only, fail-closed; no implicit peer discovery; cross-registry number resolution preserves relaying identity.
- §8: reference-implementation endpoint enumeration updated (search / verify/artifact / registry status added; "federation not advertised" removed).
- §1.3: capability search — a registry MAY expose `GET /api/v1/search?q=` over resources/capability descriptions (registry-side discovery, complements A2A/ARD).

## Unreleased (v0.3) — 2026-08-29
- §9: quiet period 3 → 1 days (sole-editor self-review; the period is a minimum gate, not a deadline — any reviewer may request a longer period before merge).

- New §3.4: **Identifier normalization** — the literal prefix and `resource-type` are case-sensitive
  lowercase (uppercase variants are invalid and rejected, never normalized); `resource-id` is
  **case-preserving**, compared byte-for-byte (values differing only in case denote different
  resources, no Unicode normalization, no case folding); resolution is byte-exact (case-mismatch
  → 404, never case-corrected). Consequence of §3.1.1 byte-identity with upstream identifiers
  (e.g. GitHub `Microsoft/vscode`). Fixes the previously undefined "after normalization" in §4.1
  (now byte-exact) and the conflicting "normalized to lowercase" wording in §2.
- §4.6: add **content integrity verification** (artifact attestation) — `/verify/artifact` aggregation semantics: content fingerprint (L1) / issuance attestation (L3) / level / revocation (fail-closed); new predicate `content-integrity` (artifact, L1); vocabulary aligned with existing `contentIdentity` / `artifactDigest` / L1 content-fingerprint; boundary: verifies attested integrity, does not scan content.

## 0.2.0 — 2026-08-27

- §3.2: register `org` (carrier layer: number ranges/reachability), `provider` (application-layer SP), and `verifier` (independent verification entity, satisfying the §4.6 registration hard requirement).
- New §3.3: `metadata.services` attachment semantics (string capability labels vs. object attachments to org/provider; dangling-reference and number-range validation on register AND update) + number-range grant (numbers belong to the Registry; ranges authorized to orgs; `POST /api/v1/number-range/grant` administrative + public `GET /api/v1/number-ranges`).
- §4.5: agent self-held key (`#agent-key`, controller = agent DID; appended, never replacing `#registry-key`) — identity-anchor evidence for L1 subject attestation.
- §4.6: evidence credential schema (predicateType/verifier/result/checkedAt/evidenceRef/artifactDigest; predicate-subject whitelist), principal verification status (`self-declared` / `registry-confirmed` / `legal-verified`), and the `https://cha2a.org/predicate/` predicate namespace.
- §6 Security: fail-closed verification (registry unavailability = rejection) and revocation checking in verification flows (consumers MUST surface `revoked`/`suspicious`).
- §9: quiet period 7 → 3 days (sole-editor self-review; public discussion continues via the proposal thread).

## Unreleased (2026-08-23)

- §4.6: explicit L4 verifier-registration validity — every `verifiedBy` entry must reference a registered, resolvable verifier DID and a real, reachable `evidenceRef`; placeholder identifiers and RFC 2606 example URLs do not satisfy L4.
- L4 clarified as a target ecosystem state, not derivable from verification-logic demonstration alone.

## 0.1.0 (2026-08-18)

- Initial experimental release of the `did:cha2a` reference registry.
- Create / Read / discovery / trust-proof issuance over HTTP (zero dependencies).
- Ed25519 keypair auto-generated on first run; discovery advertises `publicKeys`.
- Independent verifier (`verify.js`) validating proofs against the discovery key.
