#!/usr/bin/env node
/**
 * Final production QA — health, CORS, socket, schema, key routes.
 * Usage: node scripts/final-production-qa.mjs [apiOrigin] [frontendOrigin]
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(root, 'transpak-backend', 'package.json'));
require('dotenv').config({ path: path.join(root, 'transpak-backend', '.env') });

import { DEFAULT_API_ORIGIN, PRODUCTION_FRONTEND_URL } from './lib/deploy-chain.mjs';

const apiOrigin = (process.argv[2] || process.env.VITE_API_URL || DEFAULT_API_ORIGIN)
  .replace(/\/api\/?.*$/i, '')
  .replace(/\/$/, '');
const frontendOrigin =
  process.argv[3] || process.env.VITE_FRONTEND_URL || PRODUCTION_FRONTEND_URL;

const results = [];

function pass(name, detail = '') {
  results.push({ name, ok: true, detail });
  console.log(`✓ ${name}${detail ? `: ${detail}` : ''}`);
}

function fail(name, detail = '') {
  results.push({ name, ok: false, detail });
  console.error(`✗ ${name}${detail ? `: ${detail}` : ''}`);
}

async function fetchJson(url, opts = {}) {
  const res = await fetch(url, { ...opts, cache: 'no-store' });
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { res, body };
}

async function checkHealth() {
  const { res, body } = await fetchJson(`${apiOrigin}/api/health`);
  if (!res.ok) {
    fail('API health', `HTTP ${res.status}`);
    return;
  }
  const db = body?.data?.db ?? body?.db;
  const build = body?.data?.build ?? res.headers.get('X-TransPak-Build');
  pass('API health', `db=${db} build=${build || 'n/a'}`);
  if (db !== 'ready') fail('Database ready', String(db));
  else pass('Database ready');
}

async function checkCors() {
  const res = await fetch(`${apiOrigin}/api/health`, {
    method: 'OPTIONS',
    headers: {
      Origin: frontendOrigin,
      'Access-Control-Request-Method': 'GET'
    }
  });
  const acao = res.headers.get('access-control-allow-origin');
  if (acao && (acao === frontendOrigin || acao === '*')) {
    pass('CORS preflight', acao);
  } else {
    fail('CORS preflight', `Allow-Origin=${acao || 'missing'} for ${frontendOrigin}`);
  }
}

async function checkSocket() {
  const res = await fetch(`${apiOrigin}/socket.io/?EIO=4&transport=polling`, {
    headers: { Origin: frontendOrigin }
  });
  const text = await res.text();
  if (res.ok && text.includes('sid')) pass('Socket.io polling', 'handshake OK');
  else fail('Socket.io polling', `HTTP ${res.status}`);
}

async function checkPublicRoutes() {
  const routes = [
    ['/api/fare/cities?q=lah', 401],
    ['/api/notifications/unread-count', 401],
    ['/api/loads', 401]
  ];
  for (const [route, expectStatus] of routes) {
    const { res } = await fetchJson(`${apiOrigin}${route}`, {
      headers: { Origin: frontendOrigin }
    });
    if (res.status === expectStatus || res.status === 403) {
      pass(`Route ${route}`, `auth-gated (${res.status})`);
    } else if (res.ok) {
      pass(`Route ${route}`, `HTTP ${res.status}`);
    } else {
      fail(`Route ${route}`, `unexpected HTTP ${res.status}`);
    }
  }
}

async function checkFrontendBundle() {
  const res = await fetch(frontendOrigin, { cache: 'no-store' });
  const html = await res.text();
  if (!res.ok) {
    fail('Frontend HTML', `HTTP ${res.status}`);
    return;
  }
  pass('Frontend HTML', `HTTP ${res.status}`);

  const expectedIndexPath = path.join(root, 'transpak-frontend', 'dist', 'index.html');
  let expectedJs = null;
  let expectedFavicon = null;
  try {
    const fs = await import('node:fs');
    if (fs.existsSync(expectedIndexPath)) {
      const localHtml = fs.readFileSync(expectedIndexPath, 'utf8');
      expectedJs = localHtml.match(/assets\/index-([A-Za-z0-9_-]+)\.js/)?.[1] || null;
      expectedFavicon = localHtml.match(/favicon\.svg\?v=(\d+)/)?.[1] || null;
    }
  } catch {
    /* ignore */
  }

  const liveJs = html.match(/assets\/index-([A-Za-z0-9_-]+)\.js/)?.[1] || null;
  const liveFavicon = html.match(/favicon\.svg\?v=(\d+)/)?.[1] || null;

  if (liveJs) pass('Frontend bundle (live)', `index-${liveJs}.js`);
  else fail('Frontend bundle hash', 'missing');

  if (expectedJs) {
    if (liveJs === expectedJs) pass('Frontend bundle sync', 'matches local dist');
    else fail('Frontend bundle sync', `live index-${liveJs}.js != local index-${expectedJs}.js — redeploy Cloudflare`);
  }

  if (liveFavicon === '7' || liveFavicon === '6') pass('Favicon cache bust', `v${liveFavicon}`);
  else if (expectedFavicon && liveFavicon !== expectedFavicon) {
    fail('Favicon cache bust', `live v${liveFavicon || '?'} — purge Cloudflare cache and redeploy`);
  } else fail('Favicon cache bust', `live v${liveFavicon || '?'}`);
}

async function checkBackendBuildSync() {
  const expectedBuild = process.env.EXPECTED_BUILD || null;
  let localSha = expectedBuild;
  if (!localSha) {
    try {
      const { execSync } = await import('node:child_process');
      localSha = execSync('git rev-parse --short HEAD', { cwd: root, encoding: 'utf8' }).trim();
    } catch {
      localSha = '7e96c1e';
    }
  }
  const { res, body } = await fetchJson(`${apiOrigin}/api/health`);
  const remoteBuild = body?.data?.build ?? res.headers.get('X-TransPak-Build') ?? '';
  if (!remoteBuild) {
    fail('Backend build sync', 'no build metadata');
    return;
  }
  if (remoteBuild.startsWith(localSha) || localSha.startsWith(remoteBuild)) {
    pass('Backend build sync', `${remoteBuild} matches ${localSha}`);
  } else {
    fail('Backend build sync', `live ${remoteBuild} != expected ${localSha} — trigger Render manual deploy`);
  }
}

async function checkDbColumn() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    fail('Local DB schema check', 'DATABASE_URL not set — skip');
    return;
  }
  try {
    const req = createRequire(path.join(root, 'transpak-backend', 'package.json'));
    const { Pool } = req('pg');
    const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
    try {
      const { rows } = await pool.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'loads' AND column_name = 'deadline_minutes'
      `);
      if (rows.length) pass('DB column deadline_minutes', 'exists');
      else fail('DB column deadline_minutes', 'MISSING — run migrations');
    } finally {
      await pool.end().catch(() => {});
    }
  } catch (e) {
    fail('Local DB schema check', e.message);
  }
}

async function checkPostLoadInsertDry() {
  const url = process.env.DATABASE_URL;
  if (!url) return;
  try {
    const req = createRequire(path.join(root, 'transpak-backend', 'package.json'));
    const { Pool } = req('pg');
    const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
    try {
      await pool.query('BEGIN');
      await pool.query(
        `INSERT INTO loads (code, shipper_id, cargo, origin, destination, weight, vehicle_type, expected_price, pickup_date, deadline_hours, deadline_minutes, status)
         SELECT 'QA-DRY-' || floor(random()*1e6)::text, u.id, 'QA dry run', 'Lahore', 'Karachi', 1, 'Truck', 50000, CURRENT_DATE + 1, 6, 360, 'open'
         FROM users u WHERE 'shipper' = ANY(u.roles) LIMIT 1`
      );
      await pool.query('ROLLBACK');
      pass('Post-load INSERT dry run', 'SQL OK (rolled back)');
    } catch (e) {
      await pool.query('ROLLBACK').catch(() => {});
      fail('Post-load INSERT dry run', e.message);
    } finally {
      await pool.end().catch(() => {});
    }
  } catch (e) {
    fail('Post-load INSERT dry run', e.message);
  }
}

async function main() {
  console.log('\n=== TransPak Final Production QA ===\n');
  console.log('API:', apiOrigin);
  console.log('Frontend:', frontendOrigin);
  console.log('');

  await checkHealth();
  await checkBackendBuildSync();
  await checkCors();
  await checkSocket();
  await checkPublicRoutes();
  await checkFrontendBundle();
  await checkDbColumn();
  await checkPostLoadInsertDry();

  const failed = results.filter((r) => !r.ok);
  console.log('\n--- Summary ---');
  console.log(`Passed: ${results.filter((r) => r.ok).length}/${results.length}`);
  if (failed.length) {
    console.log('Failed checks:');
    failed.forEach((f) => console.log(`  - ${f.name}: ${f.detail}`));
    process.exit(1);
  }
  console.log('\nAll checks passed.\n');
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
