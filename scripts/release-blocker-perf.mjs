#!/usr/bin/env node
/**
 * Release blocker — P50/P95/P99 latency on key authenticated endpoints.
 * Usage: node scripts/release-blocker-perf.mjs
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import fs from 'node:fs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const backendRoot = path.join(root, 'transpak-backend');
const require = createRequire(path.join(backendRoot, 'package.json'));
require('dotenv').config({ path: path.join(backendRoot, '.env') });

const API = (process.env.QA_BASE_URL || 'https://transpak-backend-1.onrender.com').replace(/\/$/, '');
const PASS = process.env.PHASE1_RBAC_PASSWORD || process.env.E2E_SHIPPER_PASSWORD || '11223344';
const SHIPPER = process.env.E2E_SHIPPER_EMAIL || process.env.E2E_SHIPPER_ONLY_EMAIL || 'transpak.phase1.shipper@example.com';
const CARRIER = process.env.E2E_CARRIER_EMAIL || process.env.E2E_CARRIER_ONLY_EMAIL || 'transpak.phase1.carrier@example.com';
const SAMPLES = Number(process.env.PERF_SAMPLES || 30);
const P95_TARGET_MS = Number(process.env.PERF_P95_TARGET_MS || 2000);

async function login(email, roleHint) {
  const res = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASS, roleHint })
  });
  const body = await res.json();
  return body?.data?.token;
}

async function timedGet(path, token) {
  const start = performance.now();
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }
  });
  await res.text();
  if (res.status < 200 || res.status >= 300) {
    return { ms: performance.now() - start, ok: false, status: res.status };
  }
  return { ms: performance.now() - start, ok: true, status: res.status };
}

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

async function bench(name, path, token) {
  const times = [];
  for (let i = 0; i < SAMPLES; i += 1) {
    const sample = await timedGet(path, token);
    if (!sample.ok) {
      return { name, path, n: i, p50: 0, p95: 0, p99: 0, pass: false, status: sample.status };
    }
    times.push(sample.ms);
  }
  times.sort((a, b) => a - b);
  const stats = {
    name,
    path,
    n: times.length,
    p50: Math.round(percentile(times, 50)),
    p95: Math.round(percentile(times, 95)),
    p99: Math.round(percentile(times, 99)),
    pass: percentile(times, 95) <= P95_TARGET_MS
  };
  console.log(
    `${stats.pass ? 'PASS' : 'FAIL'} [${name}] p50=${stats.p50}ms p95=${stats.p95}ms p99=${stats.p99}ms`
  );
  return stats;
}

async function main() {
  console.log(`\n=== Release Blocker Perf (${API}) ===\n`);
  const shipperToken = await login(SHIPPER, 'shipper');
  const carrierToken = await login(CARRIER, 'carrier');
  if (!shipperToken || !carrierToken) {
    console.error('FAIL [auth] could not login E2E accounts');
    process.exit(1);
  }

  const results = [];
  results.push(await bench('dashboard-snapshot-shipper', '/api/operations/snapshot?viewAs=shipper', shipperToken));
  results.push(await bench('dashboard-snapshot-carrier', '/api/operations/snapshot?viewAs=carrier', carrierToken));
  results.push(await bench('shipment-history', '/api/shipments/history', shipperToken));
  results.push(await bench('shipments-active', '/api/shipments/active', shipperToken));
  results.push(await bench('notifications', '/api/notifications?limit=50', shipperToken));

  const active = await fetch(`${API}/api/shipments/active`, {
    headers: { Authorization: `Bearer ${shipperToken}` }
  }).then((r) => r.json());
  const rows = active?.data ?? active ?? [];
  const first = Array.isArray(rows) ? rows[0] : null;
  const trackRef = first?.trackingRef || first?.code || first?.id;
  if (trackRef) {
    results.push(
      await bench(
        'tracking',
        `/api/shipments/track/${encodeURIComponent(trackRef)}`,
        shipperToken
      )
    );
  } else {
    console.log('SKIP [tracking] no active shipment ref');
  }

  const outPath = path.join(root, 'deploy', 'release-blocker-perf.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify({ at: new Date().toISOString(), api: API, results }, null, 2));
  console.log(`\nWrote ${outPath}`);

  const failed = results.filter((r) => r.pass === false).length;
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
