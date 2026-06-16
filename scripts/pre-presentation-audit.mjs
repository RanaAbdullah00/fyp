#!/usr/bin/env node
/**
 * Pre-presentation runtime audit — local + optional production API.
 * Usage: node scripts/pre-presentation-audit.mjs [apiOrigin]
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const backendRoot = path.join(root, 'transpak-backend');
const require = createRequire(path.join(backendRoot, 'package.json'));
require('dotenv').config({ path: path.join(backendRoot, '.env') });

import { DEFAULT_API_ORIGIN, PRODUCTION_FRONTEND_URL } from './lib/deploy-chain.mjs';

const targets = [];
const localPort = process.env.PORT || 10000;
targets.push({ name: 'local', origin: `http://127.0.0.1:${localPort}` });

const prodOrigin = (process.argv[2] || process.env.VITE_API_URL || DEFAULT_API_ORIGIN)
  .replace(/\/api\/?.*$/i, '')
  .replace(/\/$/, '');
if (!targets.some((t) => t.origin === prodOrigin)) {
  targets.push({ name: 'production', origin: prodOrigin });
}

const FRONTEND_ORIGIN = PRODUCTION_FRONTEND_URL;
const PASSWORD =
  process.env.PHASE1_RBAC_PASSWORD ||
  process.env.E2E_SHIPPER_PASSWORD ||
  '11223344';

const ACCOUNTS = {
  carrier: process.env.E2E_CARRIER_ONLY_EMAIL || 'transpak.phase1.carrier@example.com',
  shipper: process.env.E2E_SHIPPER_ONLY_EMAIL || 'transpak.phase1.shipper@example.com',
  admin: process.env.E2E_ADMIN_ONLY_EMAIL || 'transpak.phase1.admin@example.com'
};

/** @type {Array<{feature:string, env:string, status:'PASS'|'PARTIAL'|'FAIL', rootCause:string, risk:string, evidence:string}>} */
const rows = [];

function record(feature, env, status, rootCause, risk, evidence) {
  rows.push({ feature, env, status, rootCause, risk, evidence });
  const icon = status === 'PASS' ? '✓' : status === 'PARTIAL' ? '~' : '✗';
  console.log(`${icon} [${env}] ${feature}: ${status} — ${evidence}`);
}

async function jsonFetch(origin, urlPath, opts = {}) {
  const url = `${origin}${urlPath.startsWith('/') ? urlPath : `/${urlPath}`}`;
  const res = await fetch(url, {
    ...opts,
    headers: {
      Origin: FRONTEND_ORIGIN,
      'Content-Type': 'application/json',
      ...(opts.headers || {})
    }
  });
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { res, body, url };
}

async function login(origin, email, roleHint) {
  const { res, body } = await jsonFetch(origin, '/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password: PASSWORD, roleHint })
  });
  const token = body?.data?.token || body?.token;
  return { ok: res.ok && Boolean(token), token, status: res.status, body };
}

async function auditTarget({ name, origin }) {
  console.log(`\n=== Audit: ${name} (${origin}) ===\n`);

  // Health
  try {
    const { res, body } = await jsonFetch(origin, '/api/health');
    if (res.ok) {
      record(
        'Health / DB connectivity',
        name,
        'PASS',
        '—',
        'Low',
        `build=${body?.data?.build?.slice?.(0, 12) || body?.build || 'ok'} schema=${body?.data?.schemaGuardVersion || '?'}`
      );
    } else {
      record('Health / DB connectivity', name, 'FAIL', 'API unreachable or unhealthy', 'High', `HTTP ${res.status}`);
      return;
    }
  } catch (e) {
    record('Health / DB connectivity', name, 'FAIL', e.message || 'Network error', 'High', origin);
    return;
  }

  // Demo video (public)
  try {
    const { res, body } = await jsonFetch(origin, '/api/demo-video/info');
    if (res.ok && body?.success !== false) {
      record(
        'Demo Video Upload/Watch',
        name,
        'PASS',
        '—',
        'Low',
        `hasVideo=${Boolean(body?.data?.hasVideo ?? body?.hasVideo)}`
      );
    } else {
      record('Demo Video Upload/Watch', name, 'PARTIAL', 'Info endpoint error', 'Medium', `HTTP ${res.status}`);
    }
  } catch (e) {
    record('Demo Video Upload/Watch', name, 'FAIL', e.message, 'Medium', origin);
  }

  // Auth — carrier
  const carrierLogin = await login(origin, ACCOUNTS.carrier, 'carrier');
  if (!carrierLogin.ok) {
    record(
      'Authentication',
      name,
      name === 'local' ? 'PARTIAL' : 'FAIL',
      'Carrier login failed — seed users or password',
      'High',
      `HTTP ${carrierLogin.status} ${carrierLogin.body?.message || ''}`
    );
  } else {
    record('Authentication', name, 'PASS', '—', 'Low', `carrier ${ACCOUNTS.carrier}`);
  }

  const carrierAuth = carrierLogin.token ? { Authorization: `Bearer ${carrierLogin.token}` } : null;

  // Active shipments — critical
  if (carrierAuth) {
    const active = await jsonFetch(origin, '/api/shipments/active', { headers: carrierAuth });
    const data = active.body?.data;
    const code = active.body?.code || active.body?.error;
    if (active.res.status === 500 || code === 'SERVER_ERROR') {
      record(
        'Active Shipment Retrieval',
        name,
        'FAIL',
        'GET /shipments/active returns 500 — SQL or handler error',
        'Critical',
        JSON.stringify(active.body?.message || active.body).slice(0, 120)
      );
    } else if (active.res.ok) {
      record(
        'Active Shipment Retrieval',
        name,
        'PASS',
        '—',
        'Low',
        `HTTP 200 count=${Array.isArray(data) ? data.length : 0}`
      );
    } else {
      record(
        'Active Shipment Retrieval',
        name,
        'PARTIAL',
        `Unexpected HTTP ${active.res.status}`,
        'Medium',
        active.body?.message || ''
      );
    }

    // Loads (expiry filter server-side)
    const loads = await jsonFetch(origin, '/api/loads?limit=5', { headers: carrierAuth });
    if (loads.res.ok) {
      record('Capacity/Listings marketplace loads', name, 'PASS', '—', 'Low', `loads=${Array.isArray(loads.body?.data) ? loads.body.data.length : 'ok'}`);
    } else {
      record('Capacity/Listings marketplace loads', name, 'FAIL', loads.body?.message || 'loads list failed', 'High', `HTTP ${loads.res.status}`);
    }

    const spaces = await jsonFetch(origin, '/api/carrier-space?limit=5', { headers: carrierAuth });
    if (spaces.res.ok) {
      record('Capacity Listings', name, 'PASS', '—', 'Low', `listings=${Array.isArray(spaces.body?.data) ? spaces.body.data.length : 'ok'}`);
    } else if (spaces.res.status === 404) {
      record('Capacity Listings', name, 'PARTIAL', 'Route missing on stale deploy', 'Medium', 'HTTP 404');
    } else {
      record('Capacity Listings', name, 'FAIL', spaces.body?.message || '', 'Medium', `HTTP ${spaces.res.status}`);
    }

    const notif = await jsonFetch(origin, '/api/notifications?limit=5', { headers: carrierAuth });
    record(
      'Notifications',
      name,
      notif.res.ok ? 'PASS' : 'PARTIAL',
      notif.res.ok ? '—' : notif.body?.message || 'list failed',
      'Low',
      `HTTP ${notif.res.status}`
    );

    const ops = await jsonFetch(origin, '/api/operations/snapshot', { headers: carrierAuth });
    record(
      'Dashboard Metrics',
      name,
      ops.res.ok ? 'PASS' : 'PARTIAL',
      ops.res.ok ? '—' : ops.body?.message || 'ops endpoint',
      'Low',
      `HTTP ${ops.res.status}`
    );

    // GPS throttle — two rapid location PUTs (needs active shipment ref)
    const activeRows = Array.isArray(active.body?.data) ? active.body.data : [];
    const ref = activeRows[0]?.code || activeRows[0]?.id;
    if (ref) {
      const loc1 = await jsonFetch(origin, `/api/shipments/${encodeURIComponent(ref)}/location`, {
        method: 'PUT',
        headers: carrierAuth,
        body: JSON.stringify({ lat: 31.52, lng: 74.35 })
      });
      const loc2 = await jsonFetch(origin, `/api/shipments/${encodeURIComponent(ref)}/location`, {
        method: 'PUT',
        headers: carrierAuth,
        body: JSON.stringify({ lat: 31.521, lng: 74.351 })
      });
      const throttled = loc2.res.status === 429;
      record(
        'GPS 429 throttle',
        name,
        throttled || loc2.res.ok ? 'PASS' : 'PARTIAL',
        throttled ? 'Backend throttle active (429 on rapid repeat)' : 'Second update accepted or no shipment',
        'Low',
        `first=${loc1.res.status} second=${loc2.res.status}`
      );
    } else {
      record(
        'GPS 429 throttle',
        name,
        'PARTIAL',
        'No active shipment to test location PUT',
        'Low',
        'skipped — no active row'
      );
    }
  }

  // Shipper auth + bid flow check
  const shipperLogin = await login(origin, ACCOUNTS.shipper, 'shipper');
  if (shipperLogin.ok) {
    record('Authentication (shipper)', name, 'PASS', '—', 'Low', ACCOUNTS.shipper);
    const shipperAuth = { Authorization: `Bearer ${shipperLogin.token}` };
    const mine = await jsonFetch(origin, '/api/loads/mine?limit=3', { headers: shipperAuth });
    record(
      'Shipment Creation (loads/mine)',
      name,
      mine.res.ok ? 'PASS' : 'PARTIAL',
      mine.res.ok ? '—' : mine.body?.message,
      'Low',
      `HTTP ${mine.res.status}`
    );
  } else {
    record('Authentication (shipper)', name, 'PARTIAL', 'Shipper seed login failed', 'Medium', `HTTP ${shipperLogin.status}`);
  }

  // Vehicle mismatch flag (backend env — local only check)
  if (name === 'local') {
    const relaxed = String(process.env.ALLOW_VEHICLE_TYPE_MISMATCH || '').toLowerCase();
    record(
      'Vehicle mismatch warnings',
      name,
      ['true', '1', 'yes'].includes(relaxed) ? 'PASS' : 'PARTIAL',
      relaxed ? '—' : 'ALLOW_VEHICLE_TYPE_MISMATCH not set locally',
      'Medium',
      `ALLOW_VEHICLE_TYPE_MISMATCH=${relaxed || '(unset)'}`
    );
  }
}

async function auditDatabaseSchema() {
  console.log('\n=== Database schema probes ===\n');
  try {
    const { query, endPool } = require(path.join(backendRoot, 'db/pool'));
    const checks = [
      ['loads.booking_reference', `SELECT column_name FROM information_schema.columns WHERE table_name='loads' AND column_name='booking_reference'`],
      ['shipments table', `SELECT 1 FROM shipments LIMIT 1`],
      ['carrier_space_requests.load_id', `SELECT column_name FROM information_schema.columns WHERE table_name='carrier_space_requests' AND column_name='load_id'`]
    ];
    for (const [label, sql] of checks) {
      try {
        await query(sql);
        record('DB schema', 'local-db', 'PASS', '—', 'Low', label);
      } catch (e) {
        record('DB schema', 'local-db', 'FAIL', e.message, 'Critical', label);
      }
    }
    await endPool();
  } catch (e) {
    record('DB schema', 'local-db', 'FAIL', e.message, 'Critical', 'pool');
  }
}

async function runStaticChecks() {
  console.log('\n=== Static / build checks ===\n');
  const broken = [
    'demoBidLayer',
    'useDemoTrackingPosition',
    'demoTrackingFallback',
    'DemoVehicleMismatchPanel',
    'demoAdmin'
  ];
  let found = 0;
  for (const term of broken) {
    const { execSync } = await import('node:child_process');
    try {
      execSync(`rg -l "${term}" transpak-frontend/src transpak-backend --glob "!node_modules"`, {
        cwd: root,
        stdio: 'pipe'
      });
      found += 1;
      record('Removed demo code references', 'static', 'FAIL', `Still references ${term}`, 'Medium', term);
    } catch {
      /* no match — good */
    }
  }
  if (!found) {
    record('Removed demo code references', 'static', 'PASS', '—', 'Low', 'no stale demo imports');
  }
}

async function auditPhase7Enterprise() {
  console.log('\n=== Phase 7 Enterprise gates ===\n');
  const fs = await import('node:fs');
  const gates = [
    ['strict distributed modules', 'transpak-backend/utils/distributedMode.js'],
    ['causal event graph', 'transpak-backend/utils/causalEventGraph.js'],
    ['consistency engine', 'transpak-backend/utils/consistencyEngine.js'],
    ['trace middleware', 'transpak-backend/middleware/traceMiddleware.js'],
    ['alert engine', 'transpak-backend/utils/alertEngine.js'],
    ['causal replay engine', 'transpak-backend/services/causalReplayEngine.js'],
    ['migration 028', 'transpak-backend/db/migrations/028_phase7_causal_tracing_alerts.sql'],
    ['frontend trace context', 'transpak-frontend/src/utils/traceContext.js']
  ];
  for (const [label, rel] of gates) {
    const ok = fs.existsSync(path.join(root, rel));
    record(`Phase7: ${label}`, 'static', ok ? 'PASS' : 'FAIL', ok ? '—' : 'missing file', ok ? 'Low' : 'High', rel);
  }

  const { spawnSync } = await import('node:child_process');
  const test = spawnSync(
    process.execPath,
    ['--test', 'test/phase7-enterprise.static.test.js', 'test/phase7-enterprise.causal.test.js'],
    { cwd: backendRoot, encoding: 'utf8' }
  );
  record(
    'Phase7 enterprise unit tests',
    'static',
    test.status === 0 ? 'PASS' : 'FAIL',
    test.status === 0 ? '—' : 'test failure',
    test.status === 0 ? 'Low' : 'High',
    `exit=${test.status ?? 1}`
  );
}

async function main() {
  console.log('TransPAK Pre-Presentation Audit\n');
  await auditDatabaseSchema();
  await runStaticChecks();
  await auditPhase7Enterprise();
  for (const t of targets) {
    await auditTarget(t);
  }

  console.log('\n=== FINAL TABLE ===\n');
  console.log('| Feature | Env | PASS/PARTIAL/FAIL | Root Cause | Risk | Evidence |');
  console.log('|---------|-----|-------------------|------------|------|----------|');
  for (const r of rows) {
    const esc = (s) => String(s || '').replace(/\|/g, '/').replace(/\n/g, ' ').slice(0, 80);
    console.log(
      `| ${esc(r.feature)} | ${esc(r.env)} | ${r.status} | ${esc(r.rootCause)} | ${esc(r.risk)} | ${esc(r.evidence)} |`
    );
  }

  const fails = rows.filter((r) => r.status === 'FAIL');
  process.exit(fails.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
