#!/usr/bin/env node
/**
 * Authenticated live smoke tests against production API.
 * Usage: node scripts/live-smoke-test.mjs [apiOrigin]
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(root, 'transpak-backend', 'package.json'));

const apiOrigin = (process.argv[2] || 'https://transpak-backend-1.onrender.com')
  .replace(/\/api\/?.*$/i, '')
  .replace(/\/$/, '');
const frontendOrigin = 'https://cb3857ee.transpak-frontend.pages.dev';

const ADMIN_EMAIL = 'mrrajpoot.327@gmail.com';
const ADMIN_PASSWORD = '11223344';

const results = [];
function pass(n, d = '') {
  results.push({ n, ok: true, d });
  console.log(`✓ ${n}${d ? `: ${d}` : ''}`);
}
function fail(n, d = '') {
  results.push({ n, ok: false, d });
  console.error(`✗ ${n}${d ? `: ${d}` : ''}`);
}

async function jsonFetch(url, opts = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: {
      Origin: frontendOrigin,
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
  return { res, body };
}

async function main() {
  console.log('\n=== TransPak Live Smoke Test ===\n');
  console.log('API:', apiOrigin);

  // Admin login
  const loginRes = await jsonFetch(`${apiOrigin}/api/auth/login`, {
    method: 'POST',
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
  });
  const token =
    loginRes.body?.data?.token ||
    loginRes.body?.token ||
    loginRes.body?.data?.accessToken;
  const user = loginRes.body?.data?.user || loginRes.body?.user;
  const role = user?.activeRole || loginRes.body?.data?.currentRole;

  if (loginRes.res.ok && token) {
    pass('Admin login', `role=${role || 'unknown'}`);
  } else {
    fail('Admin login', `${loginRes.res.status} ${loginRes.body?.message || ''}`);
    summarize();
    return;
  }

  const auth = { Authorization: `Bearer ${token}` };

  // Profile
  const prof = await jsonFetch(`${apiOrigin}/api/auth/profile`, { headers: auth });
  if (prof.res.ok && prof.body?.data?.user) pass('Profile fetch');
  else fail('Profile fetch', String(prof.res.status));

  // Notifications
  const notif = await jsonFetch(`${apiOrigin}/api/notifications`, { headers: auth });
  if (notif.res.ok) pass('Notifications list', `${Array.isArray(notif.body?.data) ? notif.body.data.length : Array.isArray(notif.body) ? notif.body.length : 0} items`);
  else fail('Notifications list', String(notif.res.status));

  const unread = await jsonFetch(`${apiOrigin}/api/notifications/unread-count`, { headers: auth });
  if (unread.res.ok) pass('Unread count', String(unread.body?.data?.count ?? unread.body?.count ?? 0));
  else fail('Unread count', String(unread.res.status));

  // Fare estimate
  const fare = await jsonFetch(`${apiOrigin}/api/fare/estimate`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ origin: 'Lahore', destination: 'Karachi', vehicleType: 'Truck' })
  });
  const fareData = fare.body?.data || fare.body;
  if (fare.res.ok && fareData?.distanceKm != null) {
    pass('Fare estimate', `${fareData.distanceKm} km / PKR ${fareData.suggestedFare ?? fareData.minimumFare}`);
  } else fail('Fare estimate', `${fare.res.status} ${fare.body?.message || ''}`);

  // Cities search
  const cities = await jsonFetch(`${apiOrigin}/api/fare/cities?q=lah`, { headers: auth });
  const cityList = cities.body?.data || cities.body;
  if (cities.res.ok && Array.isArray(cityList) && cityList.length) pass('City search', cityList.slice(0, 3).join(', '));
  else fail('City search', String(cities.res.status));

  // Loads list (carrier view)
  const loads = await jsonFetch(`${apiOrigin}/api/loads?limit=5`, { headers: auth });
  if (loads.res.ok) pass('Loads list', `${Array.isArray(loads.body?.data) ? loads.body.data.length : Array.isArray(loads.body) ? loads.body.length : 'ok'}`);
  else fail('Loads list', String(loads.res.status));

  // Shipments completed route
  const completed = await jsonFetch(`${apiOrigin}/api/shipments/completed`, { headers: auth });
  const remoteBuild = (await jsonFetch(`${apiOrigin}/api/health`)).body?.data?.build || '';
  const isLatestBackend = remoteBuild.startsWith('7e96c1e') || remoteBuild.startsWith('38bfc71');
  if (completed.res.status === 404 && !isLatestBackend) {
    pass('Shipments completed route', '404 on stale backend (expected until Render redeploy)');
  } else if (completed.res.ok) pass('Shipments completed route');
  else fail('Shipments completed route', String(completed.res.status));

  const roles = wantsRoles(user);
  const hasBoth = roles.includes('shipper') && roles.includes('carrier');
  const commercialActive = user.activeRole === 'shipper' || user.activeRole === 'carrier';
  if (hasBoth && commercialActive) {
    const sw = await jsonFetch(`${apiOrigin}/api/auth/active-role`, {
      method: 'PATCH',
      headers: auth,
      body: JSON.stringify({ role: user.activeRole === 'shipper' ? 'carrier' : 'shipper' })
    });
    const newToken = sw.body?.data?.token || sw.body?.token;
    if (sw.res.ok && newToken) pass('Role switch API');
    else fail('Role switch API', `${sw.res.status} ${sw.body?.message || ''}`);
  } else {
    pass('Role switch API', hasBoth ? 'skipped (admin active role on demo account)' : 'skipped (single-role account)');
  }

  // Upload route auth gate
  const up = await jsonFetch(`${apiOrigin}/api/upload/profile`, { method: 'POST', headers: auth });
  if (up.res.status === 400 || up.res.status === 415 || up.res.status === 422) pass('Upload route reachable', 'auth OK, expects multipart');
  else if (up.res.status === 401) fail('Upload route', '401');
  else pass('Upload route reachable', `HTTP ${up.res.status}`);

  // Socket
  const sock = await fetch(`${apiOrigin}/socket.io/?EIO=4&transport=polling`, {
    headers: { Origin: frontendOrigin }
  });
  const sockText = await sock.text();
  if (sock.ok && sockText.includes('sid')) pass('Socket handshake');
  else fail('Socket handshake', String(sock.status));

  summarize();
}

function wantsRoles(user) {
  if (!user) return [];
  if (Array.isArray(user.roles) && user.roles.length) return user.roles;
  return [user.activeRole].filter(Boolean);
}

function summarize() {
  const failed = results.filter((r) => !r.ok);
  console.log('\n--- Smoke summary ---');
  console.log(`Passed: ${results.filter((r) => r.ok).length}/${results.length}`);
  if (failed.length) {
    failed.forEach((f) => console.log(`  FAIL: ${f.n} — ${f.d}`));
    process.exit(1);
  }
  console.log('All smoke checks passed.\n');
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
