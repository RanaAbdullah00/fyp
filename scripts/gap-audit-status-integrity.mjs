#!/usr/bin/env node
import { loadEnv, login, dbQuery, writeArtifact } from './gap-audit-utils.mjs';

const BACKWARD = { intransit: 'booked', booked: 'posted', delivered: 'intransit' };

async function main() {
  const env = loadEnv();
  const shipper = await login(env.API, env.SHIPPER, env.PASS, 'shipper');
  const carrier = await login(env.API, env.CARRIER, env.PASS, 'carrier');
  if (!shipper.token || !carrier.token) {
    console.error('FAIL: login');
    process.exit(1);
  }

  const activeRes = await fetch(`${env.API}/api/shipments/active`, {
    headers: { Authorization: `Bearer ${carrier.token}` }
  });
  const rows = (await activeRes.json())?.data || [];
  const row = rows.find((r) => {
    const s = String(r.status || r.shipmentStatus || '').toLowerCase();
    return ['booked', 'pickedup', 'intransit', 'delivered'].includes(s);
  }) || rows[0];

  if (!row) {
    writeArtifact('status-integrity', { pass: false, error: 'no active shipment' });
    console.log('FAIL [status-integrity] no active shipment');
    process.exit(1);
  }

  const ref = row.trackRef || row.code || row.loadCode || row.id;
  const loadId = row.loadId || row.id;

  let dbStatus = null;
  if (process.env.DATABASE_URL) {
    const { rows: dbRows } = await dbQuery(
      `SELECT s.status::text AS status FROM shipments s WHERE s.load_id = $1 ORDER BY s.updated_at DESC LIMIT 1`,
      [loadId]
    );
    dbStatus = dbRows[0]?.status || null;
  }

  const trackRes = await fetch(`${env.API}/api/shipments/track/${encodeURIComponent(ref)}`, {
    headers: { Authorization: `Bearer ${carrier.token}` }
  });
  const trackBody = await trackRes.json();
  const apiStatus =
    trackBody?.data?.tracking?.status ||
    trackBody?.data?.status ||
    trackBody?.tracking?.status;

  const norm = (s) => String(s || '').toLowerCase().replace(/[\s_-]+/g, '');
  const dbApiMatch = !dbStatus || norm(dbStatus) === norm(apiStatus) || norm(apiStatus).includes(norm(dbStatus));

  const illegalTarget = BACKWARD[norm(apiStatus)] || BACKWARD[norm(dbStatus)] || 'posted';
  const backwardRes = await fetch(`${env.API}/api/shipments/${encodeURIComponent(ref)}/status`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${carrier.token}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `gap-status-back-${Date.now()}`
    },
    body: JSON.stringify({ status: illegalTarget })
  });

  const backwardRejected = backwardRes.status === 400;

  const pass = trackRes.ok && dbApiMatch && backwardRejected;
  const artifact = writeArtifact('status-integrity', {
    pass,
    ref,
    loadId,
    dbStatus,
    apiStatus,
    dbApiMatch,
    backwardAttempt: illegalTarget,
    backwardStatus: backwardRes.status,
    backwardRejected
  });

  console.log(
    `${pass ? 'PASS' : 'FAIL'} [status-integrity] db=${dbStatus} api=${apiStatus} backward=${backwardRes.status}`
  );
  console.log('artifact:', artifact);
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
