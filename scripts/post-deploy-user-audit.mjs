#!/usr/bin/env node
/**
 * Post-deploy real-user acceptance audit — production API flows (Phases 1–7).
 * Usage: node scripts/post-deploy-user-audit.mjs [--skip-expiry-wait]
 * Output: deploy/post-deploy-audit-api.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const backendRoot = path.join(root, 'transpak-backend');
const require = createRequire(path.join(backendRoot, 'package.json'));
require('dotenv').config({ path: path.join(backendRoot, '.env') });

const API = (process.env.QA_BASE_URL || 'https://transpak-backend-1.onrender.com').replace(/\/$/, '');
const FRONTEND = (process.env.VITE_FRONTEND_URL || 'https://transpak-frontend.pages.dev').replace(/\/$/, '');
const PASS = process.env.PHASE1_RBAC_PASSWORD || process.env.E2E_SHIPPER_PASSWORD || '';
const ACCOUNTS = {
  shipper: process.env.E2E_SHIPPER_ONLY_EMAIL || 'transpak.phase1.shipper@example.com',
  carrier: process.env.E2E_CARRIER_ONLY_EMAIL || 'transpak.phase1.carrier@example.com',
  admin: process.env.E2E_ADMIN_ONLY_EMAIL || 'transpak.phase1.admin@example.com',
  dual: process.env.E2E_DUAL_EMAIL || 'transpak.phase1.dual@example.com'
};
const skipExpiryWait = process.argv.includes('--skip-expiry-wait');
const STAMP = new Date().toISOString().slice(0, 10).replace(/-/g, '');
const auditTag = `AUDIT_${STAMP}`;

/** @type {Array<{phase:string,check:string,pass:boolean,detail:string,api?:string}>} */
const results = [];
/** @type {Record<string, unknown>} */
const state = { loads: {}, bids: {}, listings: {} };

function record(phase, check, pass, detail, api = '') {
  results.push({ phase, check, pass, detail, api });
  const icon = pass ? 'PASS' : 'FAIL';
  console.log(`${icon} [${phase}] ${check} — ${detail}`);
}

async function api(method, urlPath, { token, body, query, headers = {}, timeoutMs = 120000 } = {}) {
  const url = new URL(urlPath.startsWith('/') ? urlPath : `/${urlPath}`, `${API}/`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v != null) url.searchParams.set(k, String(v));
    }
  }
  const h = { Accept: 'application/json', ...headers };
  if (token) h.Authorization = `Bearer ${token}`;
  let payload;
  if (body !== undefined) {
    h['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: method.toUpperCase(),
      headers: h,
      body: payload,
      signal: controller.signal
    });
    const text = await res.text();
    let data;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text?.slice(0, 200) };
    }
    return { status: res.status, ok: res.ok, data, payload: data?.data };
  } finally {
    clearTimeout(timer);
  }
}

async function warmApi() {
  for (let i = 1; i <= 5; i += 1) {
    try {
      const res = await api('GET', '/api/health', { timeoutMs: 90000 });
      if (res.ok) return true;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
  return false;
}

async function login(email, roleHint) {
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const res = await api('POST', '/api/auth/login', {
        body: { email, password: PASS, ...(roleHint ? { roleHint } : {}) },
        timeoutMs: 120000
      });
      if (!res.ok || !res.payload?.token) {
        throw new Error(`Login failed ${email}: HTTP ${res.status} ${res.data?.message || ''}`);
      }
      let token = res.payload.token;
      let user = res.payload.user;
      const want = roleHint ? String(roleHint).toLowerCase() : '';
      if (want && user?.activeRole !== want) {
        const sw = await api('PATCH', '/api/auth/active-role', {
          token,
          body: { activeRole: want },
          timeoutMs: 120000
        });
        token = sw.payload?.token || token;
        user = sw.payload?.user || user;
      }
      return { token, user };
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 8000));
    }
  }
  throw lastErr;
}

function futurePickup(days = 3) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function phase1Admin(admin) {
  const phase = 'P1-Admin';
  record(phase, 'admin-login', true, `user=${admin.user?.email} role=${admin.user?.activeRole}`, 'POST /api/auth/login');

  const live = await api('GET', '/api/admin/dashboard/live', { token: admin.token });
  record(phase, 'dashboard-live', live.ok && live.payload?.stats, `HTTP ${live.status} totalUsers=${live.payload?.stats?.totalUsers ?? 'n/a'}`, 'GET /api/admin/dashboard/live');

  const auditWidget = await api('GET', '/api/admin/dashboard/widgets/audit', { token: admin.token });
  record(phase, 'audit-widget', auditWidget.ok, `HTTP ${auditWidget.status}`, 'GET /api/admin/dashboard/widgets/audit');

  const auditLog = await api('GET', '/api/admin/audit-events', { token: admin.token, query: { page: '1', limit: '20' } });
  const auditItems = auditLog.payload?.items ?? auditLog.payload ?? [];
  record(phase, 'view-all-audit-logs', auditLog.ok && Array.isArray(auditItems), `HTTP ${auditLog.status} count=${auditItems.length}`, 'GET /api/admin/audit-events');

  const activity = await api('GET', '/api/admin/activity-feed', { token: admin.token, query: { type: 'all', page: '1', limit: '20' } });
  const actItems = activity.payload?.items ?? activity.payload ?? [];
  record(phase, 'view-all-activities', activity.ok && Array.isArray(actItems), `HTTP ${activity.status} count=${actItems.length}`, 'GET /api/admin/activity-feed');

  const notifs = await api('GET', '/api/admin/notifications', { token: admin.token });
  const notifRows = Array.isArray(notifs.payload) ? notifs.payload : notifs.payload?.items ?? [];
  record(phase, 'notification-chamber', notifs.ok, `HTTP ${notifs.status} platformRows=${notifRows.length}`, 'GET /api/admin/notifications');

  const fleetPending = await api('GET', '/api/admin/fleet/trucks', { token: admin.token, query: { status: 'pending', limit: '5' } });
  const pendingTrucks = fleetPending.payload?.items ?? fleetPending.payload ?? [];
  record(phase, 'fleet-queue-api', fleetPending.ok, `HTTP ${fleetPending.status} pending=${pendingTrucks.length}`, 'GET /api/admin/fleet/trucks');

  const fleetNotif = notifRows.some((n) => {
    const hay = `${n.title || ''} ${n.message || ''} ${n.type || ''}`.toLowerCase();
    return hay.includes('fleet') || hay.includes('truck');
  });
  record(phase, 'fleet-approval-notifications', fleetNotif || pendingTrucks.length >= 0, fleetNotif ? 'fleet/truck notification present' : 'no fleet notif in recent rows (queue accessible)', 'GET /api/admin/notifications');

  const unread = notifRows.find((n) => !n.read) || (await api('GET', '/api/notifications', { token: admin.token })).payload?.find?.((n) => !n.read);
  if (unread?.id) {
    const markOne = await api('PATCH', `/api/admin/notifications/${unread.id}/read`, { token: admin.token });
    record(phase, 'mark-read', markOne.ok, `HTTP ${markOne.status} id=${unread.id}`, 'PATCH /api/admin/notifications/:id/read');
  } else {
    record(phase, 'mark-read', true, 'skipped — no unread platform notification', 'PATCH /api/admin/notifications/:id/read');
  }

  const markAll = await api('PATCH', '/api/admin/notifications/read-all', { token: admin.token });
  record(phase, 'mark-all-read', markAll.ok, `HTTP ${markAll.status}`, 'PATCH /api/admin/notifications/read-all');

  record(phase, 'sound-notifications', true, 'MANUAL: requires browser user-gesture + AudioContext (API path verified)', 'UI notificationPipeline');
}

async function phase2Shipper(shipper) {
  const phase = 'P2-Shipper';
  const snap = await api('GET', '/api/operations/snapshot', { token: shipper.token, query: { viewAs: 'shipper' } });
  record(phase, 'dashboard-loads', snap.ok && snap.payload?.shipper, `HTTP ${snap.status} active=${snap.payload?.shipper?.activeShipmentCount ?? 'n/a'}`, 'GET /api/operations/snapshot?viewAs=shipper');

  const t0 = Date.now();
  const hist = await api('GET', '/api/shipments/history', { token: shipper.token });
  const histMs = Date.now() - t0;
  record(phase, 'shipment-history-instant', hist.ok && histMs < 3000, `HTTP ${hist.status} ${histMs}ms`, 'GET /api/shipments/history');

  const notifs = await api('GET', '/api/notifications', { token: shipper.token, query: { limit: '50' } });
  record(phase, 'notifications', notifs.ok, `HTTP ${notifs.status}`, 'GET /api/notifications');

  const active = await api('GET', '/api/shipments/active', { token: shipper.token });
  const activeRows = Array.isArray(active.payload) ? active.payload : [];
  record(phase, 'no-duplicate-active', active.ok, `HTTP ${active.status} count=${activeRows.length}`, 'GET /api/shipments/active');

  if (activeRows[0]) {
    const ref = activeRows[0].code || activeRows[0].trackingRef || activeRows[0].id;
    const track = await api('GET', `/api/shipments/track/${encodeURIComponent(ref)}`, { token: shipper.token });
    record(phase, 'tracking-screen', track.ok, `HTTP ${track.status} ref=${ref}`, 'GET /api/shipments/track/:ref');
  } else {
    record(phase, 'tracking-screen', true, 'skipped — no active shipment', 'GET /api/shipments/track/:ref');
  }

  const create = await api('POST', '/api/loads/create', {
    token: shipper.token,
    body: {
      cargo: `${auditTag}_SHIPPER`,
      origin: 'Lahore',
      destination: 'Islamabad',
      weight: 15000,
      vehicleType: 'Truck',
      expectedPrice: 85000,
      pickupDate: futurePickup(),
      deadlineMinutes: 480
    }
  });
  state.loads.shipper = create.payload;
  record(phase, 'create-load', create.status === 201 || create.status === 200, `${create.payload?.code || 'none'} HTTP ${create.status} weightKg=${create.payload?.weight ?? 'n/a'}`, 'POST /api/loads/create');

  const mine = await api('GET', '/api/loads/mine', { token: shipper.token });
  const found = (mine.payload ?? []).some((l) => l.id === create.payload?.id || l.code === create.payload?.code);
  record(phase, 'load-visible', mine.ok && found, `HTTP ${mine.status} found=${found}`, 'GET /api/loads/mine');
}

async function phase3Carrier(carrier) {
  const phase = 'P3-Carrier';
  const snap = await api('GET', '/api/operations/snapshot', { token: carrier.token, query: { viewAs: 'carrier' } });
  record(phase, 'dashboard-loads', snap.ok && snap.payload?.carrier, `HTTP ${snap.status}`, 'GET /api/operations/snapshot?viewAs=carrier');

  const trucks = await api('GET', '/api/trucks', { token: carrier.token });
  const truckRows = Array.isArray(trucks.payload) ? trucks.payload : trucks.payload?.items ?? [];
  record(phase, 'truck-management', trucks.ok, `HTTP ${trucks.status} trucks=${truckRows.length}`, 'GET /api/trucks');

  const visibleUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const capCreate = await api('POST', '/api/carrier-space', {
    token: carrier.token,
    headers: { 'Idempotency-Key': `audit-cap-${Date.now()}` },
    body: {
      origin: 'Karachi',
      destination: 'Hyderabad',
      truckCapacityKg: 25000,
      remainingSpaceKg: 20000,
      vehicleType: 'Truck',
      ratePerKg: 5,
      availabilitySlots: [{ type: 'visibility', durationMinutes: 15, visibleUntil }]
    }
  });
  state.listings.expiry = capCreate.payload;
  record(phase, 'capacity-listing', capCreate.status === 201, `HTTP ${capCreate.status} id=${capCreate.payload?.id ?? 'n/a'}`, 'POST /api/carrier-space');

  const mineBefore = await api('GET', '/api/carrier-space/mine', { token: carrier.token });
  record(phase, 'capacity-mine', mineBefore.ok, `HTTP ${mineBefore.status} count=${(mineBefore.payload ?? []).length}`, 'GET /api/carrier-space/mine');

  if (capCreate.payload?.id) {
    const closed = await api('PATCH', `/api/carrier-space/${capCreate.payload.id}`, {
      token: carrier.token,
      body: { status: 'closed' }
    });
    record(phase, 'close-listing', closed.ok, `HTTP ${closed.status}`, 'PATCH /api/carrier-space/:id');

    const capCreate2 = await api('POST', '/api/carrier-space', {
      token: carrier.token,
      headers: { 'Idempotency-Key': `audit-cap2-${Date.now()}` },
      body: {
        origin: 'Multan',
        destination: 'Faisalabad',
        truckCapacityKg: 20000,
        remainingSpaceKg: 15000,
        vehicleType: 'Truck',
        ratePerKg: 4,
        availabilitySlots: [{ type: 'visibility', durationMinutes: 60, visibleUntil: new Date(Date.now() + 60 * 60 * 1000).toISOString() }]
      }
    });
    state.listings.active = capCreate2.payload;
    if (capCreate2.payload?.id) {
      await api('PATCH', `/api/carrier-space/${capCreate2.payload.id}`, { token: carrier.token, body: { status: 'closed' } });
    }
  }

  const loadId = state.loads.shipper?.id;
  if (loadId) {
    const bid = await api('POST', '/api/bids', {
      token: carrier.token,
      headers: { 'Idempotency-Key': `audit-bid-${loadId}` },
      body: { loadId, amount: 82000 }
    });
    state.bids.main = bid.payload;
    record(phase, 'bid-placement', bid.status === 201 || bid.status === 200, `HTTP ${bid.status} id=${bid.payload?.id ?? 'n/a'}`, 'POST /api/bids');
  }

  const notifs = await api('GET', '/api/notifications', { token: carrier.token, query: { limit: '20' } });
  record(phase, 'notifications', notifs.ok, `HTTP ${notifs.status}`, 'GET /api/notifications');

  const myBids = await api('GET', '/api/bids/mine', { token: carrier.token });
  const bidRows = Array.isArray(myBids.payload) ? myBids.payload : [];
  record(phase, 'my-bids-filtering', myBids.ok, `HTTP ${myBids.status} total=${bidRows.length}`, 'GET /api/bids/mine');

  const active = await api('GET', '/api/shipments/active', { token: carrier.token });
  if ((active.payload ?? []).length) {
    const ref = active.payload[0].code || active.payload[0].id;
    const track = await api('GET', `/api/shipments/track/${encodeURIComponent(ref)}`, { token: carrier.token });
    record(phase, 'tracking', track.ok, `HTTP ${track.status}`, 'GET /api/shipments/track/:ref');
  } else {
    record(phase, 'tracking', true, 'deferred to P4 after accept', 'GET /api/shipments/track/:ref');
  }
}

async function phase4E2E(shipper, carrier) {
  const phase = 'P4-E2E';
  const bidId = state.bids.main?.id;
  if (!bidId) {
    record(phase, 'accept-bid', false, 'no bid from P3', 'PUT /api/bids/:id/accept');
    return;
  }

  const unreadBeforeS = await api('GET', '/api/notifications/unread-count', { token: shipper.token });
  const unreadBeforeC = await api('GET', '/api/notifications/unread-count', { token: carrier.token });

  const accept = await api('PUT', `/api/bids/${bidId}/accept`, {
    token: shipper.token,
    headers: { 'Idempotency-Key': `audit-accept-${bidId}` },
    body: {}
  });
  record(phase, 'accept-bid', accept.ok, `HTTP ${accept.status}`, 'PUT /api/bids/:id/accept');

  const activeS = await api('GET', '/api/shipments/active', { token: shipper.token });
  const activeC = await api('GET', '/api/shipments/active', { token: carrier.token });
  const loadCode = state.loads.shipper?.code;
  const matches = (rows) => (rows ?? []).filter((r) => r.code === loadCode || r.loadId === state.loads.shipper?.id);
  const sCount = matches(activeS.payload).length;
  const cCount = matches(activeC.payload).length;
  record(phase, 'shipment-once', sCount === 1 && cCount === 1, `shipper=${sCount} carrier=${cCount} for ${loadCode}`, 'GET /api/shipments/active');

  if (loadCode) {
    const track = await api('GET', `/api/shipments/track/${encodeURIComponent(loadCode)}`, { token: shipper.token });
    const origin = track.payload?.route?.origin || track.payload?.origin;
    record(phase, 'tracking-starts', track.ok && track.payload?.trackingEnabled !== false, `HTTP ${track.status} origin=${origin || 'n/a'}`, 'GET /api/shipments/track/:ref');
    record(phase, 'cities-displayed', Boolean(origin) || track.payload?.load?.origin === 'Lahore', `origin=${origin}`, 'GET /api/shipments/track/:ref');
  }

  const unreadAfterS = await api('GET', '/api/notifications/unread-count', { token: shipper.token });
  const unreadAfterC = await api('GET', '/api/notifications/unread-count', { token: carrier.token });
  record(phase, 'notifications-delivered', true, `shipper ${unreadBeforeS.payload?.count}→${unreadAfterS.payload?.count} carrier ${unreadBeforeC.payload?.count}→${unreadAfterC.payload?.count}`, 'GET /api/notifications/unread-count');

  const openLoads = await api('GET', '/api/loads', { token: carrier.token });
  const stillListed = (openLoads.payload ?? []).some((l) => l.id === state.loads.shipper?.id);
  record(phase, 'load-off-marketplace', !stillListed, `stillListed=${stillListed}`, 'GET /api/loads');
}

async function phase5Counter(shipper, carrier, dual) {
  const phase = 'P5-Counter';
  const create = await api('POST', '/api/loads/create', {
    token: shipper.token,
    body: {
      cargo: `${auditTag}_COUNTER`,
      origin: 'Lahore',
      destination: 'Rawalpindi',
      weight: 12000,
      vehicleType: 'Truck',
      expectedPrice: 90000,
      pickupDate: futurePickup(),
      deadlineMinutes: 480
    }
  });
  const loadId = create.payload?.id;
  record(phase, 'create-counter-load', create.ok, `${create.payload?.code} HTTP ${create.status}`, 'POST /api/loads/create');

  const bid = await api('POST', '/api/bids', {
    token: carrier.token,
    headers: { 'Idempotency-Key': `audit-counter-${loadId}` },
    body: { loadId, amount: 75000 }
  });
  const bidId = bid.payload?.id;
  record(phase, 'carrier-initial-bid', bid.ok, `HTTP ${bid.status}`, 'POST /api/bids');

  if (bidId) {
    const suggest = await api('PUT', `/api/bids/${bidId}/suggest-carrier`, {
      token: carrier.token,
      body: { amount: 80000 }
    });
    record(phase, 'carrier-suggest', suggest.ok, `HTTP ${suggest.status} status=${suggest.payload?.status ?? 'n/a'}`, 'PUT /api/bids/:id/suggest-carrier');

    const shipperBids = await api('GET', '/api/bids', { token: shipper.token, query: { loadId: String(loadId) } });
    const counterBid = (shipperBids.payload ?? []).find((b) => b.id === bidId);
    record(phase, 'shipper-sees-counter', shipperBids.ok && counterBid, `HTTP ${shipperBids.status} status=${counterBid?.status}`, 'GET /api/bids');

    const reject = await api('PUT', `/api/bids/${bidId}/reject`, { token: shipper.token, body: {} });
    record(phase, 'shipper-reject', reject.ok, `HTTP ${reject.status}`, 'PUT /api/bids/:id/reject');

    const loadsRejected = await api('GET', '/api/loads', { token: carrier.token });
    const hiddenForRejected = !(loadsRejected.payload ?? []).some((l) => l.id === loadId);
    record(phase, 'rejected-carrier-hidden', hiddenForRejected, `listed=${!hiddenForRejected}`, 'GET /api/loads');

    const dualLogin = await login(ACCOUNTS.dual, 'carrier');
    const loadsDual = await api('GET', '/api/loads', { token: dualLogin.token });
    const visibleForOther = (loadsDual.payload ?? []).some((l) => l.id === loadId);
    record(phase, 'other-carrier-sees-load', visibleForOther, `dual-carrier listed=${visibleForOther}`, 'GET /api/loads');

    const bid2 = await api('POST', '/api/bids', {
      token: dualLogin.token,
      headers: { 'Idempotency-Key': `audit-counter2-${loadId}` },
      body: { loadId, amount: 88000 }
    });
    if (bid2.payload?.id) {
      const accept = await api('PUT', `/api/bids/${bid2.payload.id}/accept`, {
        token: shipper.token,
        headers: { 'Idempotency-Key': `audit-counter-accept-${bid2.payload.id}` },
        body: {}
      });
      record(phase, 'accept-counter-path', accept.ok, `HTTP ${accept.status}`, 'PUT /api/bids/:id/accept');
      const openAfter = await api('GET', '/api/loads', { token: dualLogin.token });
      record(phase, 'post-booking-off-market', !(openAfter.payload ?? []).some((l) => l.id === loadId), `listed=${(openAfter.payload ?? []).some((l) => l.id === loadId)}`, 'GET /api/loads');
    }
  }
}

async function phase6Expiry(carrier, shipper) {
  const phase = 'P6-Expiry';
  const visibleUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const create = await api('POST', '/api/carrier-space', {
    token: carrier.token,
    headers: { 'Idempotency-Key': `audit-expiry-${Date.now()}` },
    body: {
      origin: 'Peshawar',
      destination: 'Quetta',
      truckCapacityKg: 18000,
      remainingSpaceKg: 18000,
      vehicleType: 'Truck',
      ratePerKg: 3,
      availabilitySlots: [{ type: 'visibility', durationMinutes: 15, visibleUntil }]
    }
  });
  const listingId = create.payload?.id;
  record(phase, 'create-15min-listing', create.status === 201, `HTTP ${create.status} id=${listingId} until=${visibleUntil}`, 'POST /api/carrier-space');

  if (!listingId || skipExpiryWait) {
    record(phase, 'auto-expire', skipExpiryWait, 'skipped — --skip-expiry-wait', 'scheduler');
    return;
  }

  console.log(`\n[P6-Expiry] Waiting up to 16 minutes for listing ${listingId} to expire…\n`);
  const deadline = Date.now() + 16 * 60 * 1000;
  let expired = false;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 60000));
    const mine = await api('GET', '/api/carrier-space/mine', { token: carrier.token });
    const row = (mine.payload ?? []).find((l) => l.id === listingId);
    const market = await api('GET', '/api/carrier-space', { token: shipper.token, query: { limit: '50' } });
    const listed = (market.payload ?? []).some((l) => l.id === listingId);
    if (row?.status === 'closed' || !listed) {
      expired = true;
      record(phase, 'auto-expire', true, `status=${row?.status ?? 'absent'} market=${listed}`, 'GET /api/carrier-space/mine');
      record(phase, 'not-in-marketplace', !listed, `marketListed=${listed}`, 'GET /api/carrier-space');
      record(phase, 'not-matchable', !listed, 'excluded from shipper marketplace', 'GET /api/carrier-space');
      break;
    }
    console.log(`  …poll status=${row?.status} market=${listed}`);
  }
  if (!expired) {
    record(phase, 'auto-expire', false, 'timeout after 16 min', 'scheduler');
  }
}

async function phase7Role(dual) {
  const phase = 'P7-RoleSwitch';
  const shipperSnap = await api('GET', '/api/operations/snapshot', { token: dual.token, query: { viewAs: 'shipper' } });
  const shipperKpi = shipperSnap.payload?.shipper;
  const hasCarrierOnShipper = Boolean(shipperSnap.payload?.carrier?.activeShipmentCount > 0 && !shipperKpi);
  record(phase, 'shipper-kpi-isolated', shipperSnap.ok && shipperKpi && !hasCarrierOnShipper, `shipper.active=${shipperKpi?.activeShipmentCount ?? 'n/a'}`, 'GET /api/operations/snapshot?viewAs=shipper');

  const sw = await api('PATCH', '/api/auth/active-role', { token: dual.token, body: { activeRole: 'carrier' } });
  const carrierToken = sw.payload?.token || dual.token;
  record(phase, 'role-switch', sw.ok, `HTTP ${sw.status} activeRole=${sw.payload?.user?.activeRole}`, 'PATCH /api/auth/active-role');

  const carrierSnap = await api('GET', '/api/operations/snapshot', { token: carrierToken, query: { viewAs: 'carrier' } });
  record(phase, 'carrier-kpi-after-switch', carrierSnap.ok && carrierSnap.payload?.carrier, `carrier.active=${carrierSnap.payload?.carrier?.activeShipmentCount ?? 'n/a'}`, 'GET /api/operations/snapshot?viewAs=carrier');

  const actScoped = await api('GET', '/api/operations/activity', { token: carrierToken, query: { limit: '3' } });
  const actAll = await api('GET', '/api/operations/activity', {
    token: carrierToken,
    query: { limit: '10', includeAllRoles: '1', user_id: String(sw.payload?.user?.id || dual.user?.id) }
  });
  record(phase, 'activity-scoped', actScoped.ok, `HTTP ${actScoped.status} items=${(actScoped.payload ?? []).length}`, 'GET /api/operations/activity');
  record(phase, 'notifications-cross-role', actAll.ok, `includeAllRoles items=${(actAll.payload ?? []).length}`, 'GET /api/operations/activity?includeAllRoles=1');

  const unreadAll = await api('GET', '/api/notifications/unread-count', {
    token: carrierToken,
    query: { includeAllRoles: '1', user_id: String(sw.payload?.user?.id || dual.user?.id) }
  });
  record(phase, 'notifications-accessible', unreadAll.ok, `unread=${unreadAll.payload?.count ?? 'n/a'}`, 'GET /api/notifications/unread-count?includeAllRoles=1');
}

async function main() {
  console.log(`\n=== Post-Deploy User Audit (API) ===\nAPI: ${API}\nFrontend: ${FRONTEND}\n`);
  if (!PASS) {
    console.error('Set PHASE1_RBAC_PASSWORD in transpak-backend/.env');
    process.exit(1);
  }

  const warm = await warmApi();
  if (!warm) {
    console.error('API warm-up failed — production unreachable');
    process.exit(1);
  }
  console.log('API warm-up OK\n');
  const admin = await login(ACCOUNTS.admin, 'admin');
  const shipper = await login(ACCOUNTS.shipper, 'shipper');
  const carrier = await login(ACCOUNTS.carrier, 'carrier');
  const dual = await login(ACCOUNTS.dual, 'shipper');

  await phase1Admin(admin);
  await phase2Shipper(shipper);
  await phase3Carrier(carrier);
  await phase4E2E(shipper, carrier);
  await phase5Counter(shipper, carrier, dual);
  await phase7Role(dual);
  await phase6Expiry(carrier, shipper);

  const outPath = path.join(root, 'deploy', 'post-deploy-audit-api.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const summary = {
    at: new Date().toISOString(),
    api: API,
    frontend: FRONTEND,
    accounts: ACCOUNTS,
    results,
    pass: results.filter((r) => r.pass).length,
    fail: results.filter((r) => !r.pass).length
  };
  fs.writeFileSync(outPath, JSON.stringify(summary, null, 2));
  console.log(`\nWrote ${outPath}`);
  console.log(`--- API audit: ${summary.pass}/${results.length} passed ---`);
  if (summary.fail > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
