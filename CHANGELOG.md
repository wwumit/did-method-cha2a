## Unreleased (v0.4)

- §1.2: federation from "out of scope" → "specified minimally" (§4.2.1 + §7.5).
- §4.2.1: optional federation peer profile — registry/status, registry/peers (admin-gated mutation), registry/trust/{did} (local-first, read-only, fail-closed forward to explicitly configured peers only).
- §5.2: discovery document example + SHOULD advertise `federation` capability and `registryStatus`/`registryPeers`/`registryTrust` endpoints when the peer profile is deployed.
- §7.5: operational requirements — explicit-config relay only, local-first, read-only, fail-closed; no implicit peer discovery; cross-registry number resolution preserves relaying identity.
- §8: reference-implementation endpoint enumeration updated (search / verify/artifact / registry status added; "federation not advertised" removed).

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

# Changelog

## Unreleased (2026-08-23)

- §4.6: explicit L4 verifier-registration validity — every `verifiedBy` entry must reference a registered, resolvable verifier DID and a real, reachable `evidenceRef`; placeholder identifiers and RFC 2606 example URLs do not satisfy L4.
- L4 clarified as a target ecosystem state, not derivable from verification-logic demonstration alone.

## 0.1.0 (2026-08-18)

- Initial experimental release of the `did:cha2a` reference registry.
- Create / Read / discovery / trust-proof issuance over HTTP (zero dependencies).
- Ed25519 keypair auto-generated on first run; discovery advertises `publicKeys`.
- Independent verifier (`verify.js`) validating proofs against the discovery key.
