# Changelog

## 0.1.0 (2026-08-18)

- Initial experimental release of the `did:cha2a` reference registry.
- Create / Read / discovery / trust-proof issuance over HTTP (zero dependencies).
- Ed25519 keypair auto-generated on first run; discovery advertises `publicKeys`.
- Independent verifier (`verify.js`) validating proofs against the discovery key.
