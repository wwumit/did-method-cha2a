#!/usr/bin/env node
/**
 * cha2a — reference registry (zero-dependency Node), v0.2
 *
 * Implements the did:cha2a DID method specification (v0.1 draft):
 *   POST /api/v1/register            Create  -> assigns did:cha2a:<type>:<id>
 *   GET  /api/v1/did/<did>           Read    -> W3C DID Document (JSON-LD)
 *   GET  /.well-known/cha2a          Discovery -> publicKeys + supportedMethods
 *   GET  /api/v1/trust/proof?did=..  Issuance -> signed trust proof (Ed25519)
 *   GET  /api/v1/trust/query?did=..  Trust lookup -> status + certification level
 *   GET  /badge/<type>/<id>          Badge   -> SVG trust badge
 *   POST /api/v1/trust/revoke        Revoke  -> revoke trust (mark resource)
 *   GET  /api/v1/trust/revocations   Revocations list
 *   POST /api/v1/deactivate          Deactivate -> suspended/revoked/deprecated
 *
 * Certification levels (mapping of the DSH ecosystem proposal, annex C):
 *   L0 none | L1 content hash | L2 author | L3 publisher/store | L4 evidence
 *
 * Data: ./data/keys.json, ./data/registry.json, ./data/revocations.json
 * Zero dependencies: node:crypto + node:http only.
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = parseInt(process.env.PORT || '8787', 10);
const HOST = process.env.HOST || '127.0.0.1';
const REGISTRY_DID = process.env.REGISTRY_DID || 'did:cha2a:registry:compliancehub.cn';
const DATA_DIR = path.join(__dirname, 'data');
const KEYS_FILE = path.join(DATA_DIR, 'keys.json');
const REGISTRY_FILE = path.join(DATA_DIR, 'registry.json');
const REVOCATIONS_FILE = path.join(DATA_DIR, 'revocations.json');
const SUBMISSIONS_FILE = path.join(DATA_DIR, 'submissions.json');
const CATALOG_FILE = '/var/www/dshlib-store/catalog.json';

// ---- helpers -------------------------------------------------------------

const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function base58Encode(buf) {
  let x = BigInt('0x' + buf.toString('hex'));
  let out = '';
  while (x > 0n) { out = B58[Number(x % 58n)] + out; x /= 58n; }
  for (const b of buf) { if (b === 0) out = '1' + out; else break; }
  return out;
}
const TYPE_RE = /^[a-z][a-z0-9_]*$/;
const ID_RE = /^[A-Za-z0-9._\-/@:]+$/;
const DID_RE = /^did:cha2a:([a-z][a-z0-9_]*):([A-Za-z0-9._\-/@:]+)$/;
const DEACTIVATE_STATUS = ['suspended', 'revoked', 'deprecated'];

function readJSON(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
function writeJSON(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}
let _baseUrl = null;
function baseUrl() { return _baseUrl || `http://${HOST}:${PORT}`; }

// ---- keys ------------------------------------------------------------------

function ensureKeys() {
  const existing = readJSON(KEYS_FILE, null);
  if (existing) return existing;
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const keys = {
    version: 1,
    algorithm: 'Ed25519',
    publicKey: publicKey.export({ type: 'spki', format: 'der' }).toString('base64'),
    privateKey: privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64'),
    createdAt: new Date().toISOString(),
    status: 'signing',
  };
  writeJSON(KEYS_FILE, keys);
  return keys;
}
function keyPair(keys) {
  return {
    publicKey: crypto.createPublicKey({ key: Buffer.from(keys.publicKey, 'base64'), type: 'spki', format: 'der' }),
    privateKey: crypto.createPrivateKey({ key: Buffer.from(keys.privateKey, 'base64'), type: 'pkcs8', format: 'der' }),
  };
}
function publicKeyMultibase(keys) {
  const der = Buffer.from(keys.publicKey, 'base64');
  const raw = der.subarray(der.length - 32);
  return 'z' + base58Encode(Buffer.concat([Buffer.from([0xed, 0x01]), raw]));
}

// ---- stores -----------------------------------------------------------------

function loadRegistry() { return readJSON(REGISTRY_FILE, { records: {} }); }
function saveRegistry(reg) { writeJSON(REGISTRY_FILE, reg); }
function loadRevocations() { return readJSON(REVOCATIONS_FILE, { revocations: [] }); }
function saveRevocations(r) { writeJSON(REVOCATIONS_FILE, r); }

// ---- certification level (DSH proposal annex C, simplified) ----------------

const LEVEL_NAMES = ['L0 unverified', 'L1 integrity', 'L2 source', 'L3 issuance', 'L4 ecosystem'];
function levelOf(record) {
  const m = record.metadata || {};
  let level = 0;
  if (m.contentHash || m.contentIdentity) level = Math.max(level, 1);  // L1 integrity
  if (m.author) level = Math.max(level, 2);                    // L2 source
  if (m.publisher || m.store) level = Math.max(level, 3);      // L3 issuance
  // L4 ecosystem: requires L3 base (issuance) + ≥2 independent verifiers (distinct DIDs)
  // 递进原则：L4 不能跳过 L2/L3——多验证方只是在已有发行背书之上再叠加独立验证
  if (level >= 3 && Array.isArray(m.verifiedBy) && m.verifiedBy.length >= 2) {
    const dids = new Set(m.verifiedBy.map((v) => v.verifier).filter(Boolean));
    if (dids.size >= 2) level = Math.max(level, 4);
  }
  return level;
}

// ---- DID Document construction (spec §5) -----------------------------------

function buildDidDocument(record) {
  const now = new Date().toISOString();
  const { type, id, metadata } = record;
  const did = `did:cha2a:${type}:${id}`;
  const doc = {
    '@context': [
      'https://www.w3.org/ns/did/v1',
      'https://w3id.org/security/suites/ed25519-2020/v1',
    ],
    id: did,
    verificationMethod: [{
      id: `${did}#registry-key`,
      type: 'Ed25519VerificationKey2020',
      controller: REGISTRY_DID,
      publicKeyMultibase: publicKeyMultibase(ensureKeys()),
    }],
    authentication: [`${did}#registry-key`],
    assertionMethod: [`${did}#registry-key`],
    service: [
      { id: `${did}#trust-lookup`, type: 'TrustLookup', serviceEndpoint: `${baseUrl()}/api/v1/trust/query?did=${encodeURIComponent(did)}` },
      { id: `${did}#trust-proof`, type: 'TrustProof', serviceEndpoint: `${baseUrl()}/api/v1/trust/proof?did=${encodeURIComponent(did)}` },
      { id: `${did}#badge`, type: 'TrustBadge', serviceEndpoint: `${baseUrl()}/badge/${type}/${encodeURIComponent(id)}` },
    ],
    created: record.created || now,
    updated: now,
    ...(metadata ? { metadata } : {}),
  };
  return doc;
}

// ---- trust proof -----------------------------------------------------------

function stripCatalogMeta(p) {
  const { name, title, description, author, source, version, stars, tags, did } = p;
  return { name, title, description, author, source, version, stars, tags, did };
}

function issueTrustProof(did) {
  const keys = ensureKeys();
  const { privateKey } = keyPair(keys);
  const created = new Date().toISOString();
  const payload = JSON.stringify({ did, type: 'TrustProof', created });
  const signatureValue = crypto.sign(null, Buffer.from(payload), privateKey).toString('base64');
  return {
    did,
    proof: {
      type: 'Ed25519Signature2020',
      created,
      verificationMethod: `${did}#registry-key`,
      proofPurpose: 'assertionMethod',
      payload,
      signatureValue,
    },
  };
}

// ---- trust lookup ------------------------------------------------------------

function trustStatus(record) {
  const did = `did:cha2a:${record.type}:${record.id}`;
  const level = levelOf(record);
  const revoked = loadRevocations().revocations.some((r) => r.did === did);
  const active = !record.status || record.status === 'active';
  return {
    did,
    type: record.type,
    id: record.id,
    registered: true,
    active,
    status: record.status || 'active',
    level,
    levelName: LEVEL_NAMES[level],
    revoked,
    ...(record.metadata ? { metadata: record.metadata } : {}),
  };
}

// ---- badge (SVG, zero dependency) -------------------------------------------

const LEVEL_COLORS = ['#9aa0a6', '#1aa7a0', '#1f6feb', '#8b5cf6', '#0d5c75'];  // 对齐 l0-l4 徽章图主色：灰/青/蓝/紫/深青
function badgeSvg(record) {
  const level = levelOf(record);
  const color = LEVEL_COLORS[level];
  const revoked = loadRevocations().revocations.some((r) => r.did === `did:cha2a:${record.type}:${record.id}`);
  const label = revoked ? 'cha2a revoked' : `cha2a ${LEVEL_NAMES[level]}`;
  const bg = revoked ? '#c92a2a' : color;
  const w = 62 + label.length * 6.2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w.toFixed(0)}" height="20">
  <rect width="100%" height="20" rx="3" fill="${bg}"/>
  <text x="8" y="14" font-family="Helvetica,Arial,sans-serif" font-size="11" fill="${level === 4 && !revoked ? '#f5c518' : '#fff'}">${label}</text>
</svg>`;
}

// ---- HTTP server -------------------------------------------------------------

function send(res, code, body, contentType) {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(code, {
    'Content-Type': contentType || 'application/json; charset=utf-8',
    'Cache-Control': 'public, max-age=300',
  });
  res.end(text);
}
function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 1e6) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch { resolve({}); } });
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${HOST}:${PORT}`);
  const p = url.pathname;

  // Discovery
  if (req.method === 'GET' && p === '/.well-known/cha2a') {
    const keys = ensureKeys();
    return send(res, 200, {
      capabilities: ['trust-proof', 'trust-lookup', 'badge', 'revocation', 'deactivation'],
      endpoints: {
        didResolve: '/api/v1/did/{did}',
        trustLookup: '/api/v1/trust/query',
        trustProof: '/api/v1/trust/proof',
        trustRevoke: '/api/v1/trust/revoke',
        trustRevocations: '/api/v1/trust/revocations',
        deactivate: '/api/v1/deactivate',
      },
      publicKeys: [{
        version: keys.version,
        algorithm: keys.algorithm,
        publicKey: keys.publicKey,
        status: keys.status,
        createdAt: keys.createdAt,
      }],
      registryDid: REGISTRY_DID,
      supportedMethods: ['did:cha2a'],
      version: '1.0',
    }, 'application/json');
  }

  // Register (Create)
  if (req.method === 'POST' && p === '/api/v1/register') {
    const body = await readBody(req);
    const type = String(body.type || '').toLowerCase();
    const id = String(body.id || '');
    const metadata = body.metadata && typeof body.metadata === 'object' ? body.metadata : undefined;
    if (!TYPE_RE.test(type)) return send(res, 400, { error: `invalid resource-type: ${type}` });
    if (!ID_RE.test(id)) return send(res, 400, { error: `invalid resource-id: ${id}` });
    const reg = loadRegistry();
    const key = `${type}/${id}`;
    if (reg.records[key]) return send(res, 409, { error: `resource already registered: ${key}` });
    const record = { type, id, created: new Date().toISOString(), status: 'active', ...(metadata ? { metadata } : {}) };
    reg.records[key] = record;
    saveRegistry(reg);
    return send(res, 201, { did: `did:cha2a:${type}:${id}`, status: 'active', level: levelOf(record), levelName: LEVEL_NAMES[levelOf(record)], ...record });
  }

  // Update metadata (credential lifecycle: issuance → use → update → revocation)
  // 只合并/覆盖 metadata，不改 type/id（身份不变）；可用于等级升级（如补 author→L2、publisher→L3）
  if (req.method === 'POST' && p === '/api/v1/update') {
    const body = await readBody(req);
    const type = String(body.type || '').toLowerCase();
    const id = String(body.id || '');
    const metadata = body.metadata && typeof body.metadata === 'object' ? body.metadata : undefined;
    if (!TYPE_RE.test(type)) return send(res, 400, { error: `invalid resource-type: ${type}` });
    if (!ID_RE.test(id)) return send(res, 400, { error: `invalid resource-id: ${id}` });
    const reg = loadRegistry();
    const key = `${type}/${id}`;
    const record = reg.records[key];
    if (!record) return send(res, 404, { error: `resource not found: ${key}` });
    if (record.status !== 'active') return send(res, 409, { error: `resource not active: ${key}` });
    record.metadata = { ...(record.metadata || {}), ...(metadata || {}) };
    record.updated = new Date().toISOString();
    saveRegistry(reg);
    return send(res, 200, { did: `did:cha2a:${type}:${id}`, status: 'active', level: levelOf(record), levelName: LEVEL_NAMES[levelOf(record)], ...record });
  }

  // Resolve (Read)
  if (req.method === 'GET' && p.startsWith('/api/v1/did/')) {
    const did = decodeURIComponent(p.slice('/api/v1/did/'.length));
    const m = DID_RE.exec(did);
    if (!m) return send(res, 400, { error: `syntactically invalid did: ${did}` });
    const reg = loadRegistry();
    const record = reg.records[`${m[1]}/${m[2]}`];
    if (!record) return send(res, 404, { error: `resource not found: ${m[1]}/${m[2]}` });
    const doc = buildDidDocument(record);
    // spec §4.4: bare DID Document for active DIDs; full resolution result to report deactivation
    if (record.status && record.status !== 'active') {
      return send(res, 200, { didDocument: doc, didDocumentMetadata: { deactivated: true, status: record.status } }, 'application/did+ld+json');
    }
    return send(res, 200, doc, 'application/did+ld+json');
  }

  // Trust proof (issuance)
  if (req.method === 'GET' && p === '/api/v1/trust/proof') {
    const did = url.searchParams.get('did') || '';
    const m = DID_RE.exec(did);
    if (!m) return send(res, 400, { error: `syntactically invalid did: ${did}` });
    const reg = loadRegistry();
    const record = reg.records[`${m[1]}/${m[2]}`];
    if (!record) return send(res, 404, { error: `resource not found: ${m[1]}/${m[2]}` });
    const revoked = loadRevocations().revocations.some((r) => r.did === did);
    if (revoked || (record.status && record.status !== 'active')) {
      return send(res, 409, { error: `trust not issuable: resource ${revoked ? 'revoked' : record.status}` });
    }
    return send(res, 200, issueTrustProof(did));
  }

  // Trust lookup
  if (req.method === 'GET' && p === '/api/v1/trust/query') {
    const did = url.searchParams.get('did') || '';
    const type = url.searchParams.get('type');
    const name = url.searchParams.get('name');
    let m = DID_RE.exec(did);
    if (!m && type && name) m = ['', type.toLowerCase(), name];
    if (!m) return send(res, 400, { error: 'provide ?did= or ?type=&name=' });
    const reg = loadRegistry();
    const record = reg.records[`${m[1]}/${m[2]}`];
    if (!record) return send(res, 404, { error: `resource not found: ${m[1]}/${m[2]}` });
    return send(res, 200, trustStatus(record));
  }

  // Badge
  const badgeM = /^\/badge\/([a-z][a-z0-9_]*)\/(.+)$/.exec(p);
  if (req.method === 'GET' && badgeM) {
    const reg = loadRegistry();
    const id = decodeURIComponent(badgeM[2]);
    const record = reg.records[`${badgeM[1]}/${id}`];
    if (!record) return send(res, 404, { error: `resource not found: ${badgeM[1]}/${badgeM[2]}` });
    res.writeHead(200, { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=60' });
    return res.end(badgeSvg(record));
  }

  // Revoke
  if (req.method === 'POST' && p === '/api/v1/trust/revoke') {
    const body = await readBody(req);
    const m = DID_RE.exec(String(body.did || ''));
    if (!m) return send(res, 400, { error: 'syntactically invalid did' });
    const reg = loadRegistry();
    if (!reg.records[`${m[1]}/${m[2]}`]) return send(res, 404, { error: `resource not found: ${m[1]}/${m[2]}` });
    const revs = loadRevocations();
    if (!revs.revocations.some((r) => r.did === body.did)) {
      revs.revocations.push({ did: body.did, reason: body.reason || 'no reason given', at: new Date().toISOString() });
      saveRevocations(revs);
    }
    return send(res, 200, { did: body.did, revoked: true });
  }

  // Revocations list
  if (req.method === 'GET' && p === '/api/v1/trust/revocations') {
    return send(res, 200, loadRevocations());
  }

  // dshlib 提交队列（作者自助上架申请）
  if (req.method === 'POST' && p === '/api/dshlib/submissions') {
    const body = await readBody(req);
    const pkg = String(body.pkg || '').trim();
    const type = String(body.type || 'npm').trim();
    if (!pkg) return send(res, 400, { error: 'pkg is required' });
    const subs = readJSON(SUBMISSIONS_FILE, { submissions: [] });
    subs.submissions.push({
      id: 'sub-' + Date.now().toString(36),
      type, pkg,
      author: String(body.author || '').trim(),
      desc: String(body.desc || '').trim(),
      submittedAt: body.submittedAt || new Date().toISOString(),
      status: 'pending',
    });
    writeJSON(SUBMISSIONS_FILE, subs);
    return send(res, 201, { ok: true, id: subs.submissions[subs.submissions.length - 1].id });
  }
  if (req.method === 'GET' && p === '/api/dshlib/submissions') {
    return send(res, 200, readJSON(SUBMISSIONS_FILE, { submissions: [] }));
  }

  // ── dshlib 开放 API（只读，生态消费）──
  if (req.method === 'GET' && p === '/api/dshlib/catalog') {
    const cat = readJSON(CATALOG_FILE, { plugins: [] });
    const tag = url.searchParams.get('tag');
    const level = url.searchParams.get('level');
    let list = cat.plugins || [];
    if (tag) list = list.filter((x) => (x.tags || []).includes(tag));
    if (level) list = list.filter((x) => (x.tags || []).includes(level));
    return send(res, 200, { count: list.length, plugins: list.map(stripCatalogMeta) });
  }
  if (req.method === 'GET' && p.startsWith('/api/dshlib/catalog/')) {
    const name = decodeURIComponent(p.slice('/api/dshlib/catalog/'.length));
    const cat = readJSON(CATALOG_FILE, { plugins: [] });
    const hit = (cat.plugins || []).find((x) => x.name === name || x.package === name);
    if (!hit) return send(res, 404, { error: 'plugin not found: ' + name });
    return send(res, 200, hit);
  }
  if (req.method === 'GET' && p === '/api/dshlib/verification') {
    const reg = loadRegistry();
    const ver = Object.entries(reg.records)
      .map(([k, r]) => ({ did: `did:cha2a:${r.type}:${r.id}`, id: r.id, evidence: (r.metadata || {}).verificationEvidence || null }))
      .filter((x) => x.evidence);
    return send(res, 200, { count: ver.length, verified: ver });
  }
  if (req.method === 'GET' && p === '/api/dshlib/stats') {
    const cat = readJSON(CATALOG_FILE, { plugins: [] });
    const ps = cat.plugins || [];
    const cnt = (lvl) => ps.filter((p) => (p.tags || []).includes(lvl)).length;
    return send(res, 200, {
      total: ps.length,
      levels: { L0: ps.filter((p) => !(p.tags || []).some((t) => /^L[1-4]$/.test(t))).length, L1: cnt('L1'), L2: cnt('L2'), L3: cnt('L3'), L4: cnt('L4') },
      awesome: cnt('Awesome'),
      source: 'dshlib store open API',
    });
  }

  // Deactivate
  if (req.method === 'POST' && p === '/api/v1/deactivate') {
    const body = await readBody(req);
    const m = DID_RE.exec(String(body.did || ''));
    if (!m) return send(res, 400, { error: 'syntactically invalid did' });
    const status = String(body.status || 'suspended');
    if (!DEACTIVATE_STATUS.includes(status)) return send(res, 400, { error: `invalid status: ${status}` });
    const reg = loadRegistry();
    const key = `${m[1]}/${m[2]}`;
    if (!reg.records[key]) return send(res, 404, { error: `resource not found: ${m[1]}/${m[2]}` });
    reg.records[key].status = status;
    saveRegistry(reg);
    return send(res, 200, { did: body.did, deactivated: true, status });
  }

  return send(res, 404, { error: `no such endpoint: ${req.method} ${p}` });
});

server.listen(PORT, HOST, () => {
  console.log(`cha2a registry listening on http://${HOST}:${PORT}`);
  console.log(`registry DID: ${REGISTRY_DID}`);
  console.log(`public key (multibase): ${publicKeyMultibase(ensureKeys())}`);
});
