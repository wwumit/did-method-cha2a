#!/usr/bin/env node
/**
 * cha2a — independent verifier (zero-dependency Node)
 *
 * Verifies a signed trust proof against the discovery public key.
 * Demonstrates the P0-5 property: the verifier trusts only the discovery
 * document of the configured resolver (fetching it over HTTP), never the
 * issuer's private key.
 *
 * Usage:
 *   node verify.js <proof.json> [registryBaseUrl]
 *   node verify.js <did> [registryBaseUrl]   # issues+verifies in one shot
 */
'use strict';

const http = require('http');
const fs = require('fs');
const crypto = require('crypto');

const BASE = process.argv[3] || 'http://127.0.0.1:8787';

function fetchJson(path) {
  return new Promise((resolve, reject) => {
    const u = new URL(path, BASE);
    const req = http.get(u, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(new Error('bad json: ' + data.slice(0, 200))); }
      });
    });
    req.on('error', reject);
  });
}

async function main() {
  const arg = process.argv[2];
  if (!arg) { console.error('usage: node verify.js <proof.json|did> [baseUrl]'); process.exit(2); }

  // discovery
  const discovery = await fetchJson('/.well-known/cha2a');
  const pkEntry = discovery.publicKeys.find((k) => k.status === 'signing') || discovery.publicKeys[0];
  if (!pkEntry) { console.error('no signing key in discovery'); process.exit(1); }
  const publicKey = crypto.createPublicKey({
    key: Buffer.from(pkEntry.publicKey, 'base64'), type: 'spki', format: 'der',
  });

  // obtain proof: from file, or issue via registry
  let proof;
  if (arg.startsWith('did:')) {
    proof = await fetchJson('/api/v1/trust/proof?did=' + encodeURIComponent(arg));
  } else {
    proof = JSON.parse(fs.readFileSync(arg, 'utf8'));
  }

  const sig = Buffer.from(proof.proof.signatureValue, 'base64');
  const ok = crypto.verify(null, Buffer.from(proof.proof.payload, 'utf8'), publicKey, sig);

  console.log('registry discovery :', BASE);
  console.log('registry DID       :', discovery.registryDid);
  console.log('key version        :', pkEntry.version, '| algorithm:', pkEntry.algorithm);
  console.log('subject            :', proof.did);
  console.log('proof type         :', proof.proof.type, '| purpose:', proof.proof.proofPurpose);
  console.log('created            :', proof.proof.created);
  console.log('signature          :', ok ? '✅ VALID' : '❌ INVALID');
  process.exit(ok ? 0 : 1);
}

main().catch((e) => { console.error('verify failed:', e.message); process.exit(1); });
