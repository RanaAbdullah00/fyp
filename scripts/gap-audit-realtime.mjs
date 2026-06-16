#!/usr/bin/env node
import { loadEnv, login, writeArtifact } from './gap-audit-utils.mjs';

const SYNC_DEADLINE_MS = 5000;
const POLL_MS = 250;

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function pollUntil(fn, deadlineMs) {
  const t0 = Date.now();
  while (Date.now() - t0 < deadlineMs) {
    const v = await fn();
    if (v) return { ok: true, elapsedMs: Date.now() - t0, value: v };
    await sleep(POLL_MS);
  }
  return { ok: false, elapsedMs: Date.now() - t0 };
}

async function main() {
  const env = loadEnv();
  const shipper = await login(env.API, env.SHIPPER, env.PASS, 'shipper');
  const carrier = await login(env.API, env.CARRIER, env.PASS, 'carrier');
  if (!shipper.token || !carrier.token) {
    console.error('FAIL: login');
    process.exit(1);
  }

  const pickup = new Date(Date.now() + 86400000 * 4).toISOString().slice(0, 10);
  const createRes = await fetch(`${env.API}/api/loads/create`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${shipper.token}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `gap-rt-${Date.now()}`
    },
    body: JSON.stringify({
      cargo: 'GAP_REALTIME',
      origin: 'Multan',
      destination: 'Faisalabad',
      weight: 12000,
      vehicleType: 'Truck',
      expectedPrice: 70000,
      pickupDate: pickup,
      deadlineMinutes: 720
    })
  });
  const load = (await createRes.json())?.data;
  if (!load?.id) {
    console.error('FAIL: create load');
    process.exit(1);
  }

  const bidRes = await fetch(`${env.API}/api/bids`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${carrier.token}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `gap-rt-bid-${load.id}`
    },
    body: JSON.stringify({ loadId: load.id, amount: 68000, acceptListedFare: false })
  });
  const bid = (await bidRes.json())?.data;
  if (!bid?.id) {
    console.error('FAIL: place bid', bidRes.status);
    process.exit(1);
  }

  const unreadBeforeRes = await fetch(`${env.API}/api/notifications/unread-count`, {
    headers: { Authorization: `Bearer ${carrier.token}` }
  });
  const unreadBefore = (await unreadBeforeRes.json())?.data?.count ?? 0;

  const since = new Date(Date.now() - 2000).toISOString();
  const acceptT0 = Date.now();
  const acceptRes = await fetch(`${env.API}/api/bids/${bid.id}/accept`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${shipper.token}`,
      'Idempotency-Key': `gap-rt-accept-${bid.id}`
    }
  });
  const acceptOk = acceptRes.ok;

  const activePoll = await pollUntil(async () => {
    const res = await fetch(`${env.API}/api/shipments/active`, {
      headers: { Authorization: `Bearer ${shipper.token}` }
    });
    const rows = (await res.json())?.data || [];
    return rows.some(
      (r) =>
        String(r.loadId || '') === String(load.id) ||
        String(r.id || '') === String(load.id) ||
        String(r.code || '') === String(load.code)
    );
  }, SYNC_DEADLINE_MS);

  const notifPoll = await pollUntil(async () => {
    for (const token of [carrier.token, shipper.token]) {
      const syncRes = await fetch(
        `${env.API}/api/notifications/sync?since=${encodeURIComponent(since)}&limit=20`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (syncRes.ok) {
        const body = await syncRes.json();
        const items = body?.data?.items || [];
        const unread = body?.data?.unreadCount ?? 0;
        if (items.length > 0) return true;
        if (token === carrier.token && unread > unreadBefore) return true;
      }
      const listRes = await fetch(`${env.API}/api/notifications?limit=10`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (listRes.ok) {
        const listBody = await listRes.json();
        const items = listBody?.data?.items || [];
        const hit = items.some((n) => {
          const t = String(n.title || n.type || '').toUpperCase();
          return t.includes('BID_ACCEPTED') || t.includes('CONTRACT');
        });
        if (hit) return true;
      }
    }
    return false;
  }, SYNC_DEADLINE_MS);

  const pass = acceptOk && activePoll.ok;
  const artifact = writeArtifact('realtime', {
    pass,
    phase5Core: acceptOk && activePoll.ok,
    notifSyncPass: notifPoll.ok,
    loadId: load.id,
    bidId: bid.id,
    acceptOk,
    acceptStatus: acceptRes.status,
    activeVisibleMs: activePoll.elapsedMs,
    activeVisible: activePoll.ok,
    notifSyncMs: notifPoll.elapsedMs,
    notifSync: notifPoll.ok,
    deadlineMs: SYNC_DEADLINE_MS,
    totalMs: Date.now() - acceptT0
  });

  console.log(
    `${pass ? 'PASS' : 'FAIL'} [realtime] accept=${acceptOk} active=${activePoll.ok}(${activePoll.elapsedMs}ms) notif=${notifPoll.ok}(${notifPoll.elapsedMs}ms)`
  );
  console.log('artifact:', artifact);
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
