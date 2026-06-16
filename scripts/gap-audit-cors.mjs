#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv, writeArtifact } from './gap-audit-utils.mjs';

const REQUIRED = [
  'Authorization',
  'Content-Type',
  'Idempotency-Key',
  'X-Idempotency-Key',
  'X-Requested-With'
];

async function optionsProbe(API, origin, requestHeaders) {
  const res = await fetch(`${API}/api/bids`, {
    method: 'OPTIONS',
    headers: {
      Origin: origin,
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': requestHeaders
    }
  });
  const allowHeaders = (res.headers.get('access-control-allow-headers') || '').toLowerCase();
  const maxAge = Number(res.headers.get('access-control-max-age') || 0);
  const missing = REQUIRED.filter((h) => !allowHeaders.includes(h.toLowerCase()));
  return {
    requestHeaders,
    status: res.status,
    allowHeaders: res.headers.get('access-control-allow-headers'),
    allowOrigin: res.headers.get('access-control-allow-origin'),
    maxAge,
    missing,
    pass: res.status === 204 && missing.length === 0 && maxAge >= 86400
  };
}

function staticCorsCheck() {
  const appPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'transpak-backend', 'src', 'app.js');
  const src = fs.readFileSync(appPath, 'utf8');
  const useCorsCount = (src.match(/app\.use\(cors/g) || []).length;
  const hasIdempotency = src.includes('Idempotency-Key') && src.includes('X-Idempotency-Key');
  const hasMaxAge = /maxAge:\s*86400/.test(src);
  return {
    pass: useCorsCount === 1 && hasIdempotency && hasMaxAge,
    useCorsCount,
    hasIdempotency,
    hasMaxAge
  };
}

async function main() {
  const env = loadEnv();
  const combined = REQUIRED.join(', ').toLowerCase();
  const probes = [
    await optionsProbe(env.API, env.PREVIEW_ORIGIN, combined),
    ...(
      await Promise.all(
        REQUIRED.map((h) => optionsProbe(env.API, env.PREVIEW_ORIGIN, h.toLowerCase()))
      )
    )
  ];
  const staticCheck = staticCorsCheck();
  const pass = probes.every((p) => p.pass) && staticCheck.pass;
  const artifact = writeArtifact('cors', { pass, probes, staticCheck, origin: env.PREVIEW_ORIGIN });
  console.log(`${pass ? 'PASS' : 'FAIL'} [cors] probes=${probes.filter((p) => p.pass).length}/${probes.length} static=${staticCheck.pass}`);
  if (!pass) probes.filter((p) => !p.pass).forEach((p) => console.log('  fail:', p.requestHeaders, p.missing));
  console.log('artifact:', artifact);
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
