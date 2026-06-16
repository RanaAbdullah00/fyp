#!/usr/bin/env node
import { loadEnv, login, percentile, writeArtifact } from './gap-audit-utils.mjs';

const SAMPLES = 10;
const THRESHOLD_MS = 2000;

async function main() {
  const env = loadEnv();
  const shipper = await login(env.API, env.SHIPPER, env.PASS, 'shipper');
  if (!shipper.token) {
    console.error('FAIL: shipper login');
    process.exit(1);
  }

  const activeRes = await fetch(`${env.API}/api/shipments/active`, {
    headers: { Authorization: `Bearer ${shipper.token}` }
  });
  const activeBody = await activeRes.json();
  const rows = activeBody?.data || [];
  const ref = rows[0]?.trackRef || rows[0]?.code || rows[0]?.loadCode;
  if (!ref) {
    const artifact = writeArtifact('tracking-perf', { pass: false, error: 'no active shipment ref' });
    console.log('FAIL [tracking-perf] no active shipment');
    console.log('artifact:', artifact);
    process.exit(1);
  }

  const latencies = [];
  for (let i = 0; i < SAMPLES; i++) {
    const t0 = Date.now();
    const res = await fetch(`${env.API}/api/shipments/track/${encodeURIComponent(ref)}`, {
      headers: { Authorization: `Bearer ${shipper.token}` },
      cache: 'no-store'
    });
    const ms = Date.now() - t0;
    latencies.push({ i: i + 1, ms, status: res.status, ok: res.ok });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      latencies[latencies.length - 1].error = body?.message;
    }
  }

  const msOnly = latencies.map((l) => l.ms).sort((a, b) => a - b);
  const cold = latencies[0]?.ms ?? 0;
  const warm = latencies.slice(1).map((l) => l.ms).sort((a, b) => a - b);
  const stats = {
    ref,
    coldMs: cold,
    warm: {
      p50: percentile(warm, 50),
      p95: percentile(warm, 95),
      p99: percentile(warm, 99),
      min: warm[0] ?? 0,
      max: warm[warm.length - 1] ?? 0,
      samples: warm.length
    },
    all: {
      p50: percentile(msOnly, 50),
      p95: percentile(msOnly, 95),
      p99: percentile(msOnly, 99)
    },
    latencies
  };

  const allOk = latencies.every((l) => l.ok);
  const warmP95Ok = stats.warm.p95 < THRESHOLD_MS;
  const pass = allOk && warmP95Ok;

  const artifact = writeArtifact('tracking-perf', { pass, thresholdMs: THRESHOLD_MS, ...stats });
  console.log(`${pass ? 'PASS' : 'FAIL'} [tracking-perf] ref=${ref} cold=${cold}ms warmP95=${stats.warm.p95}ms warmP50=${stats.warm.p50}ms`);
  console.log('artifact:', artifact);
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
