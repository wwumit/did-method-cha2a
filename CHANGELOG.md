## Unreleased (v0.2) — 2026-08-27

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
