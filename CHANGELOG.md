# Changelog

## Unreleased (2026-08-23)

- §4.6: explicit L4 verifier-registration validity — every `verifiedBy` entry must reference a registered, resolvable verifier DID and a real, reachable `evidenceRef`; placeholder identifiers and RFC 2606 example URLs do not satisfy L4.
- L4 clarified as a target ecosystem state, not derivable from verification-logic demonstration alone.

## 0.1.0 (2026-08-18)

- Initial experimental release of the `did:cha2a` reference registry.
- Create / Read / discovery / trust-proof issuance over HTTP (zero dependencies).
- Ed25519 keypair auto-generated on first run; discovery advertises `publicKeys`.
- Independent verifier (`verify.js`) validating proofs against the discovery key.
