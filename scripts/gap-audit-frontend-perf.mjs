#!/usr/bin/env node
import { loadEnv, writeArtifact } from './gap-audit-utils.mjs';

async function measureBundle(url) {
  const t0 = Date.now();
  const res = await fetch(url, { cache: 'no-store' });
  const buf = await res.arrayBuffer();
  return { ok: res.ok, status: res.status, ms: Date.now() - t0, bytes: buf.byteLength };
}

async function main() {
  const env = loadEnv();
  const indexRes = await fetch(`${env.FRONTEND}/`, { cache: 'no-store' });
  const html = await indexRes.text();
  const match = html.match(/src="(\/assets\/index-[^"]+\.js)"/);
  const bundlePath = match?.[1];
  const bundleUrl = bundlePath ? `${env.FRONTEND}${bundlePath}` : null;

  let cold = null;
  let warm = null;
  if (bundleUrl) {
    cold = await measureBundle(bundleUrl);
    warm = await measureBundle(bundleUrl);
  }

  const dashRes = await fetch(`${env.FRONTEND}/dashboard`, { redirect: 'follow' });
  const pass = indexRes.ok && (!warm || warm.ms < 2500);

  const artifact = writeArtifact('frontend-perf', {
    pass,
    frontend: env.FRONTEND,
    bundleUrl,
    cold,
    warm,
    dashboardStatus: dashRes.status,
    thresholdMs: 2500,
    note: 'Measurement only — no App.jsx instrumentation'
  });

  console.log(
    `${pass ? 'PASS' : 'FAIL'} [frontend-perf] bundle=${bundlePath || 'n/a'} warm=${warm?.ms ?? 'n/a'}ms`
  );
  console.log('artifact:', artifact);
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
