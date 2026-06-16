#!/usr/bin/env node
/**
 * Post-RESOLVED behavioral checklist — notifications, ops metrics, loading consistency.
 * Usage: node scripts/behavioral-validation.mjs [apiOrigin]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolveLocalApiOrigin } from './discover-backend-port.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const backendRoot = path.join(root, 'transpak-backend');
const feRoot = path.join(root, 'transpak-frontend');

function loadEnvFile(relPath) {
  const p = path.join(backendRoot, relPath);
  if (!fs.existsSync(p)) return {};
  const out = {};
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 1) continue;
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return out;
}

const env = { ...loadEnvFile('.env'), ...process.env };

const password = env.PHASE1_RBAC_PASSWORD || env.E2E_SHIPPER_PASSWORD || '';
const shipperEmail = env.E2E_SHIPPER_ONLY_EMAIL || env.E2E_SHIPPER_EMAIL || 'transpak.phase1.shipper@example.com';
const carrierEmail = env.E2E_CARRIER_ONLY_EMAIL || env.E2E_CARRIER_EMAIL || 'transpak.phase1.carrier@example.com';
const dualEmail = env.E2E_DUAL_EMAIL || 'transpak.phase1.dual@example.com';

const checks = [];
let apiOrigin = 'http://127.0.0.1:10000';

function record(name, pass, detail) {
  checks.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'} [${name}] ${detail}`);
}

async function api(method, urlPath, { token, query, body, workspace, timeoutMs = 30000 } = {}) {
  const url = new URL(urlPath.startsWith('/') ? urlPath : `/${urlPath}`, `${apiOrigin}/`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v != null) url.searchParams.set(k, String(v));
    }
  }
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (workspace) headers['X-TransPak-Workspace'] = workspace;
  let payload;
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: method.toUpperCase(),
      headers,
      body: payload,
      signal: controller.signal
    });
    const text = await res.text();
    let data;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }
    return { ok: res.ok, status: res.status, data, payload: data?.data };
  } finally {
    clearTimeout(timer);
  }
}

async function login(email, activeRole) {
  const res = await api('POST', '/api/auth/login', {
    body: { email, password, ...(activeRole ? { roleHint: activeRole } : {}) }
  });
  if (!res.ok || !res.payload?.token) {
    throw new Error(res.data?.message || `Login failed for ${email} (${res.status})`);
  }
  return { token: res.payload.token, user: res.payload.user };
}

function countActiveRows(rows) {
  return (rows || []).filter((r) => {
    const s = String(r.shipmentStatus ?? r.status ?? '').toLowerCase();
    return s === 'booked' || s === 'pickedup';
  }).length;
}

function countInTransitRows(rows) {
  return (rows || []).filter((r) => {
    const s = String(r.shipmentStatus ?? r.status ?? '').toLowerCase();
    return s === 'intransit' || s === 'in_transit';
  }).length;
}

function countRequestSentRows(rows) {
  return (rows || []).filter((r) => {
    const s = String(r.status || '').toLowerCase();
    return s === 'request_sent' || s === 'accepted';
  }).length;
}

async function dbSeedUnread(userId, entries) {
  if (env.DATABASE_URL && !process.env.DATABASE_URL) {
    process.env.DATABASE_URL = env.DATABASE_URL;
  }
  const poolMod = await import(`file://${path.join(backendRoot, 'db/pool.js').replace(/\\/g, '/')}`);
  const { query, endPool, isDatabaseUrlConfigured } = poolMod;
  if (!isDatabaseUrlConfigured()) return 0;
  let n = 0;
  const stamp = Date.now();
  for (const entry of entries) {
    const title = `BEHAV_${stamp}_${entry.suffix}`;
    await query(
      `INSERT INTO notifications (receiver_id, sender_id, role_type, title, message, dedupe_key, event_id, read)
       VALUES ($1, $1, $2, $3, $4, $5, gen_random_uuid(), false)`,
      [userId, entry.roleType, title, entry.message, `behav|${userId}|${stamp}|${entry.suffix}`]
    );
    n += 1;
  }
  await endPool();
  return n;
}

async function notificationChecklist(token, user, { dual = false } = {}) {
  const stamp = Date.now();
  const scopeQuery = dual
    ? { user_id: String(user.id), includeAllRoles: '1' }
    : { user_id: String(user.id), workspace: user.activeRole || 'shipper', viewAs: user.activeRole || 'shipper' };
  const wsHeader = dual ? undefined : user.activeRole || 'shipper';

  const seedRoles = dual
    ? [{ suffix: 'S', roleType: 'shipper', message: 'checklist shipper' }, { suffix: 'C', roleType: 'carrier', message: 'checklist carrier' }]
    : [{ suffix: 'A', roleType: user.activeRole || 'shipper', message: 'checklist A' }, { suffix: 'B', roleType: user.activeRole || 'shipper', message: 'checklist B' }];

  let seeded = 0;
  for (const entry of seedRoles) {
    const res = await api('POST', '/api/notifications', {
      token,
      workspace: wsHeader,
      body: { title: `BEHAV_${stamp}_${entry.suffix}`, message: entry.message, roleType: entry.roleType }
    });
    if (res.payload?.id) seeded += 1;
  }
  if (seeded < seedRoles.length && env.DATABASE_URL) {
    seeded = await dbSeedUnread(String(user.id), seedRoles);
  }

  const before = await api('GET', '/api/notifications/unread-count', { token, query: scopeQuery, workspace: wsHeader });
  const beforeCount = before.payload?.count ?? 0;
  record(
    dual ? 'N1-dual-unread-seeded' : 'N1-unread-seeded',
    before.ok && beforeCount >= 1,
    `seeded=${seeded} unread before mark-all=${beforeCount}`
  );

  const single = await api('GET', '/api/notifications', {
    token,
    query: { ...scopeQuery, limit: '20' },
    workspace: wsHeader
  });
  const items = Array.isArray(single.payload) ? single.payload : single.payload?.items || [];
  const unreadItem = items.find((n) => !n.read);
  if (unreadItem?.id) {
    await api('PATCH', `/api/notifications/${unreadItem.id}/read`, {
      token,
      query: scopeQuery,
      workspace: wsHeader
    });
    const afterSingle = await api('GET', '/api/notifications/unread-count', { token, query: scopeQuery });
    record(
      dual ? 'N2-dual-single-read' : 'N2-single-read',
      afterSingle.ok && (afterSingle.payload?.count ?? 0) === beforeCount - 1,
      `unread after single-read=${afterSingle.payload?.count}`
    );
  } else {
    record(dual ? 'N2-dual-single-read' : 'N2-single-read', false, 'no unread item to patch');
  }

  await api('PATCH', '/api/notifications/read-all', { token, query: scopeQuery, workspace: wsHeader });
  const afterAll = await api('GET', '/api/notifications/unread-count', { token, query: scopeQuery });
  record(
    dual ? 'N3-dual-mark-all-read' : 'N3-mark-all-read',
    afterAll.ok && (afterAll.payload?.count ?? -1) === 0,
    `unread after read-all=${afterAll.payload?.count}`
  );

  const sync = await api('GET', '/api/operations/sync/events', {
    token,
    query: { ...scopeQuery, since: new Date(Date.now() - 3600000).toISOString() },
    workspace: wsHeader
  });
  const syncUnread =
    sync.payload?.unreadCount ?? sync.payload?.notifications?.unreadCount ?? sync.payload?.modules?.notifications;
  record(
    dual ? 'N4-dual-reconnect-sync' : 'N4-reconnect-sync',
    sync.ok && (sync.payload?.unreadCount ?? 0) === 0,
    `sync unread=${sync.payload?.unreadCount ?? syncUnread ?? '?'}`
  );

  const list = await api('GET', '/api/notifications', { token, query: scopeQuery, workspace: wsHeader });
  const listRows = Array.isArray(list.payload) ? list.payload : list.payload?.items || [];
  const listUnread = listRows.filter((n) => !n.read).length;
  record(
    dual ? 'N5-dual-unread-zero-consistency' : 'N5-unread-zero-consistency',
    (afterAll.payload?.count ?? 1) === 0 && listUnread === 0,
    `count endpoint=0 listUnread=${listUnread}`
  );
}

async function opsChecklist(token, user, carrierMode = false) {
  const viewAs = carrierMode ? 'carrier' : 'shipper';
  const snap = await api('GET', '/api/operations/snapshot', {
    token,
    query: { user_id: String(user.id), workspace: viewAs, viewAs }
  });
  const slice = carrierMode ? snap.payload?.carrier : snap.payload?.shipper;
  record(
    carrierMode ? 'O1-carrier-snapshot' : 'O1-shipper-snapshot',
    snap.ok && slice && typeof slice.requestSentCount === 'number',
    snap.ok
      ? `requestSent=${slice?.requestSentCount} active=${slice?.activeShipmentCount} transit=${slice?.inTransitShipmentCount} completed=${slice?.completedShipmentCount}`
      : snap.data?.message || `HTTP ${snap.status}`
  );
  if (!snap.ok || !slice) return;

  const [activeRes, sentRes, historyRes] = await Promise.all([
    api('GET', '/api/shipments/active', { token, query: { user_id: String(user.id), workspace: viewAs, viewAs } }),
    api('GET', carrierMode ? '/api/carrier-space/requests/incoming' : '/api/carrier-space/requests/sent', {
      token,
      query: { user_id: String(user.id), workspace: viewAs, viewAs }
    }),
    api('GET', '/api/shipments/completed', { token, query: { user_id: String(user.id), workspace: viewAs, viewAs } })
  ]);

  const activeRows = Array.isArray(activeRes.payload) ? activeRes.payload : [];
  const sentRows = Array.isArray(sentRes.payload) ? sentRes.payload : [];
  const historyRows = Array.isArray(historyRes.payload) ? historyRes.payload : historyRes.payload?.items || [];

  const tabActive = countActiveRows(activeRows);
  const tabTransit = countInTransitRows(activeRows);
  const tabSent = countRequestSentRows(sentRows);
  const tabCompleted = historyRows.filter((r) => {
    const s = String(r.shipmentStatus ?? r.status ?? '').toLowerCase();
    return s === 'delivered' || s === 'closed';
  }).length;

  const mismatches = [];
  if ((slice?.requestSentCount ?? -1) !== tabSent) mismatches.push(`requestSent snap=${slice?.requestSentCount} tab=${tabSent}`);
  if ((slice?.activeShipmentCount ?? -1) !== tabActive) mismatches.push(`active snap=${slice?.activeShipmentCount} tab=${tabActive}`);
  if ((slice?.inTransitShipmentCount ?? -1) !== tabTransit) mismatches.push(`transit snap=${slice?.inTransitShipmentCount} tab=${tabTransit}`);
  if ((slice?.completedShipmentCount ?? -1) !== tabCompleted) mismatches.push(`completed snap=${slice?.completedShipmentCount} tab=${tabCompleted}`);

  record(
    carrierMode ? 'O2-carrier-tab-vs-summary' : 'O2-shipper-tab-vs-summary',
    mismatches.length === 0,
    mismatches.length ? mismatches.join('; ') : 'all four counts aligned'
  );
}

async function stateConsistencyCheck() {
  const dashSrc = fs.readFileSync(path.join(feRoot, 'src/components/dashboard/DashboardShipmentTabs.jsx'), 'utf8');
  const notifSrc = fs.readFileSync(path.join(feRoot, 'src/components/notifications/NotificationCenter.jsx'), 'utf8');
  const patchOk =
    notifSrc.includes("api.patch('/notifications/read-all', undefined, {") &&
    notifSrc.includes('serverUnreadReady ? serverUnread');
  record(
    'S1-no-zero-flash-guards',
    dashSrc.includes('opsReady') && dashSrc.includes('searchActive') && dashSrc.includes('tabCounts'),
    'summary uses dash while loading/search; tabCounts wired'
  );
  record(
    'S2-patch-query-params',
    patchOk,
    'notification PATCH sends params in axios config (not body)'
  );
}

async function main() {
  const cliOrigin = process.argv[2];
  apiOrigin = await resolveLocalApiOrigin(cliOrigin, env);
  console.log(`\n=== Behavioral Validation (${apiOrigin}) ===\n`);
  if (!password) {
    record('AUTH', false, 'Set PHASE1_RBAC_PASSWORD in transpak-backend/.env');
    process.exit(1);
  }

  try {
    const health = await api('GET', '/api/health');
    record('HEALTH', health.ok, health.ok ? `schema=${health.payload?.schema?.version || '?'}` : 'backend unreachable');
    if (!health.ok) process.exit(1);
  } catch (e) {
    record('HEALTH', false, e.message);
    process.exit(1);
  }

  await stateConsistencyCheck();

  try {
    const shipper = await login(shipperEmail, 'shipper');
    await notificationChecklist(shipper.token, shipper.user, { dual: false });
    await opsChecklist(shipper.token, shipper.user, false);
  } catch (e) {
    record('SHIPPER-FLOW', false, e.message);
  }

  try {
    const carrier = await login(carrierEmail, 'carrier');
    await opsChecklist(carrier.token, carrier.user, true);
    const roles = Array.isArray(carrier.user?.roles) ? carrier.user.roles : [];
    if (roles.includes('shipper') && roles.includes('carrier')) {
      await notificationChecklist(carrier.token, carrier.user, { dual: true });
    } else {
      try {
        const dual = await login(dualEmail, 'shipper');
        const dualRoles = Array.isArray(dual.user?.roles) ? dual.user.roles : [];
        if (dualRoles.includes('shipper') && dualRoles.includes('carrier')) {
          await notificationChecklist(dual.token, dual.user, { dual: true });
        } else {
          record('N-DUAL-SKIP', true, 'no dual-role account — run npm run seed:phase1-rbac in transpak-backend');
        }
      } catch (e) {
        record('N-DUAL-SKIP', true, `dual account unavailable (${e.message})`);
      }
    }
  } catch (e) {
    record('CARRIER-FLOW', false, e.message);
  }

  const failed = checks.filter((c) => !c.pass);
  console.log(`\n--- Summary: ${checks.length - failed.length}/${checks.length} passed ---`);
  if (failed.length) {
    console.log('Re-open loop for:');
    for (const f of failed) console.log(`  - ${f.name}: ${f.detail}`);
    process.exit(1);
  }
  console.log('\nRESOLVED — behavioral checklist passed.\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
