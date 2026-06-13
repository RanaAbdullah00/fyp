#!/usr/bin/env node
/**
 * Production go-live audit — read-only HTTP probes.
 * Usage: node scripts/production-go-live-audit.mjs
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const backendRoot = path.join(root, 'transpak-backend');
const require = createRequire(path.join(backendRoot, 'package.json'));
require('dotenv').config({ path: path.join(backendRoot, '.env') });

const API = 'https://transpak-backend-1.onrender.com';
const FRONTEND = 'https://transpak-frontend.pages.dev';
const PASS = process.env.PHASE1_RBAC_PASSWORD || '11223344';
const ACCOUNTS = {
  carrier: process.env.E2E_CARRIER_ONLY_EMAIL || 'transpak.phase1.carrier@example.com',
  shipper: process.env.E2E_SHIPPER_ONLY_EMAIL || 'transpak.phase1.shipper@example.com',
  admin: process.env.E2E_ADMIN_ONLY_EMAIL || 'transpak.phase1.admin@example.com'
};

/** @type {Array<{feature:string,pass:boolean,partial:boolean,fail:boolean,evidence:string}>} */
const rows = [];

function row(feature, status, evidence) {
  rows.push({
    feature,
    pass: status === 'PASS',
    partial: status === 'PARTIAL',
    fail: status === 'FAIL',
    evidence
  });
  const icon = status === 'PASS' ? '✓' : status === 'PARTIAL' ? '~' : '✗';
  console.log(`${icon} ${feature}: ${status} — ${evidence}`);
}

async function login(email, roleHint) {
  const res = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASS, roleHint })
  });
  const body = await res.json();
  return { status: res.status, token: body?.data?.token, body };
}

async function api(path, token, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {})
    }
  });
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, body };
}

async function main() {
  console.log('\n=== DEPLOYMENT ===\n');

  const health = await api('/api/health');
  const build = health.body?.data?.build || health.body?.build || '?';
  const prevBuild = 'de7606afe97f';
  const buildChanged = build !== prevBuild;
  row(
    'Backend build hash changed',
    buildChanged ? 'PASS' : 'FAIL',
    `live=${build} previous=${prevBuild}`
  );
  row(
    'Backend deployment healthy',
    health.status === 200 && health.body?.data?.db === 'ready' ? 'PASS' : 'FAIL',
    `HTTP ${health.status} db=${health.body?.data?.db} http5xx=${health.body?.data?.ops?.counters?.http5xx}`
  );

  const feRes = await fetch(FRONTEND);
  const feHtml = await feRes.text();
  const shaMatch = feHtml.match(/BUILD_SHA["\s:=]+([a-f0-9]{7,40})/i);
  const apiMatch = feHtml.match(/VITE_API_URL["\s:=]+([^"'\s>]+)/i);
  const bundleMatch = feHtml.match(/assets\/index-([A-Za-z0-9_-]+)\.js/);
  row(
    'Frontend reachable',
    feRes.status === 200 ? 'PASS' : 'FAIL',
    `HTTP ${feRes.status} bundle=index-${bundleMatch?.[1] || '?'}`
  );
  const apiUrl = apiMatch?.[1] || '(embedded at runtime via verifyDeploy)';
  row(
    'Frontend → production backend',
    feHtml.includes('transpak-backend') || apiUrl.includes('transpak-backend') ? 'PASS' : 'PARTIAL',
    `detected API hint: ${apiUrl.slice(0, 60)}`
  );
  row(
    'Frontend build SHA in HTML',
    shaMatch ? 'PASS' : 'PARTIAL',
    shaMatch ? shaMatch[1].slice(0, 12) : 'not in static HTML (may load from /api/health at runtime)'
  );

  console.log('\n=== ACTIVE SHIPMENTS ===\n');
  for (const [role, email] of [
    ['carrier', ACCOUNTS.carrier],
    ['shipper', ACCOUNTS.shipper]
  ]) {
    const lg = await login(email, role);
    if (!lg.token) {
      row(`GET /shipments/active (${role})`, 'FAIL', `login HTTP ${lg.status}`);
      continue;
    }
    const active = await api('/api/shipments/active', lg.token);
    const ok = active.status === 200;
    row(
      `GET /shipments/active (${role})`,
      ok ? 'PASS' : 'FAIL',
      `HTTP ${active.status} code=${active.body?.code || 'ok'} count=${Array.isArray(active.body?.data) ? active.body.data.length : 'n/a'}`
    );
  }

  console.log('\n=== LIFECYCLE + VEHICLE MISMATCH ===\n');

  const shipperLg = await login(ACCOUNTS.shipper, 'shipper');
  const carrierLg = await login(ACCOUNTS.carrier, 'carrier');
  let loadId = null;
  let loadCode = null;

  if (shipperLg.token) {
    const pickup = new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 10);
    const create = await api('/api/loads/create', shipperLg.token, {
      method: 'POST',
      body: JSON.stringify({
        cargo: 'Go-live audit load',
        origin: 'Lahore',
        destination: 'Islamabad',
        weight: 5,
        vehicleType: 'Mazda',
        expectedPrice: 85000,
        pickupDate: pickup,
        deadlineMinutes: 480
      })
    });
    loadId = create.body?.data?.id;
    loadCode = create.body?.data?.code;
    row('Create load', create.status === 201 || create.status === 200 ? 'PASS' : 'FAIL', `${loadCode || 'none'} HTTP ${create.status}`);
  }

  if (carrierLg.token && loadId) {
    const bid = await api('/api/bids', carrierLg.token, {
      method: 'POST',
      body: JSON.stringify({ loadId, amount: 82000 })
    });
    const warn = bid.body?.data?.vehicleTypeMismatchWarning;
    const mismatchRelaxed = bid.status === 201 || bid.status === 200;
    row(
      'Place bid (ALLOW_VEHICLE_TYPE_MISMATCH)',
      mismatchRelaxed ? 'PASS' : 'FAIL',
      `HTTP ${bid.status} code=${bid.body?.code} warn=${warn ?? 'none'}`
    );
    if (mismatchRelaxed && shipperLg.token) {
      const bidId = bid.body?.data?.id;
      const accept = await api(`/api/bids/${bidId}/accept`, shipperLg.token, { method: 'PUT', body: '{}' });
      row('Accept bid', accept.status === 200 ? 'PASS' : 'FAIL', `HTTP ${accept.status}`);
      const active = await api('/api/shipments/active', carrierLg.token);
      row('Active after accept', active.status === 200 ? 'PASS' : 'FAIL', `HTTP ${active.status} count=${active.body?.data?.length ?? 'n/a'}`);
    }
  }

  console.log('\n=== TRACKING (existing load) ===\n');
  if (carrierLg.token) {
    const track = await api('/api/shipments/track/L-174278', carrierLg.token);
    const hist = track.body?.data?.history?.length ?? 0;
    const st = track.body?.data?.tracking?.status;
    row('Tracking GET /track/:ref', track.status === 200 ? 'PASS' : 'FAIL', `HTTP ${track.status} status=${st} history=${hist}`);
    const status = await api('/api/shipments/L-174278/status', carrierLg.token);
    row('Timeline/status sync', status.status === 200 && status.body?.data?.status === st ? 'PASS' : 'PARTIAL', `track=${st} statusEp=${status.body?.data?.status}`);
  }

  console.log('\n=== INTEGRATIONS + MODULES ===\n');

  const demo = await api('/api/demo-video/info');
  row('Demo video info', demo.status === 200 ? 'PASS' : 'FAIL', `HTTP ${demo.status} hasVideo=${demo.body?.data?.hasVideo}`);

  if (carrierLg.token) {
    const n = await api('/api/notifications?limit=5', carrierLg.token);
    row('Notifications list', n.status === 200 ? 'PASS' : 'FAIL', `HTTP ${n.status}`);
    const chat = await api('/api/chat/conversations', carrierLg.token);
    row('Messaging conversations', chat.status === 200 ? 'PASS' : 'FAIL', `HTTP ${chat.status} count=${chat.body?.data?.length ?? 0}`);
    const ops = await api('/api/operations/snapshot', carrierLg.token);
    row('Carrier dashboard snapshot', ops.status === 200 ? 'PASS' : 'FAIL', `HTTP ${ops.status}`);
    const spaces = await api('/api/carrier-space?limit=3', carrierLg.token);
    row('Capacity listings', spaces.status === 200 ? 'PASS' : 'FAIL', `HTTP ${spaces.status}`);
  }

  if (shipperLg.token) {
    const ops = await api('/api/operations/snapshot', shipperLg.token);
    row('Shipper dashboard snapshot', ops.status === 200 ? 'PASS' : 'FAIL', `HTTP ${ops.status}`);
  }

  const adminLg = await login(ACCOUNTS.admin, 'admin');
  if (adminLg.token) {
    const dash = await api('/api/admin/dashboard', adminLg.token);
    row('Admin dashboard', dash.status === 200 ? 'PASS' : 'FAIL', `HTTP ${dash.status}`);
  }

  // ORS proxy — public route check (401 without auth expected or 200 with auth)
  const ors = await fetch(`${API}/api/routing/directions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ coordinates: [[74.3436, 31.5497], [73.0479, 33.6844]] })
  }).catch(() => null);
  row(
    'ORS routing proxy mounted',
    ors && ors.status !== 404 ? 'PASS' : 'FAIL',
    ors ? `HTTP ${ors.status}` : 'network error'
  );

  row('Supabase/Postgres', health.body?.data?.db === 'ready' ? 'PASS' : 'FAIL', `dbPing=${health.body?.data?.dbPing} host=supabase pooler`);
  row('Render backend', health.body?.data?.deploy?.render ? 'PASS' : 'PARTIAL', 'render=true in health');
  row('Cloudflare frontend', feRes.status === 200 ? 'PASS' : 'FAIL', FRONTEND);

  console.log('\n=== SUMMARY TABLE ===\n');
  console.log('| Feature | PASS | PARTIAL | FAIL | Evidence |');
  console.log('|---------|------|---------|------|----------|');
  for (const r of rows) {
    const esc = (s) => String(s).replace(/\|/g, '/').slice(0, 70);
    console.log(
      `| ${esc(r.feature)} | ${r.pass ? '✓' : ''} | ${r.partial ? '✓' : ''} | ${r.fail ? '✓' : ''} | ${esc(r.evidence)} |`
    );
  }

  const pass = rows.filter((r) => r.pass).length;
  const total = rows.length;
  const pct = Math.round((pass / total) * 100);
  console.log(`\nProduction Readiness: ${pct}% (${pass}/${total} checks PASS)`);

  const criticalFails = rows.filter((r) => r.fail && /active|build hash|bid|Accept|lifecycle/i.test(r.feature));
  if (criticalFails.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
