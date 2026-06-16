#!/usr/bin/env node
import { loadEnv, login, dbQuery, writeArtifact } from './gap-audit-utils.mjs';

const CONCURRENT = 50;

async function main() {
  const env = loadEnv();
  const shipper = await login(env.API, env.SHIPPER, env.PASS, 'shipper');
  const carrier = await login(env.API, env.CARRIER, env.PASS, 'carrier');
  if (!shipper.token || !carrier.token) {
    console.error('FAIL: login');
    process.exit(1);
  }

  const pickup = new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 10);
  const createRes = await fetch(`${env.API}/api/loads/create`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${shipper.token}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `gap-stress-${Date.now()}`
    },
    body: JSON.stringify({
      cargo: 'GAP_STRESS_BID',
      origin: 'Lahore',
      destination: 'Islamabad',
      weight: 15000,
      vehicleType: 'Truck',
      expectedPrice: 85000,
      pickupDate: pickup,
      deadlineMinutes: 480
    })
  });
  const loadBody = await createRes.json();
  const loadId = loadBody?.data?.id;
  if (!loadId) {
    console.error('FAIL: create load', createRes.status, loadBody?.message);
    process.exit(1);
  }

  const carrierUserId = carrier.user?.id;
  const t0 = Date.now();
  const results = await Promise.all(
    Array.from({ length: CONCURRENT }, (_, i) =>
      fetch(`${env.API}/api/bids`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${carrier.token}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': `gap-stress-bid-${loadId}-${i}`
        },
        body: JSON.stringify({ loadId, amount: 82000 + i, acceptListedFare: false })
      }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }))
    )
  );
  const elapsed = Date.now() - t0;

  const success = results.filter((r) => r.status >= 200 && r.status < 300).length;
  const conflict = results.filter((r) => r.status === 409).length;

  let dbCount = null;
  if (carrierUserId && process.env.DATABASE_URL) {
    const { rows } = await dbQuery(
      `SELECT COUNT(*)::int AS c FROM bids WHERE load_id = $1 AND carrier_id = $2`,
      [loadId, carrierUserId]
    );
    dbCount = rows[0]?.c ?? null;
  }

  const activeRes = await fetch(`${env.API}/api/shipments/active`, {
    headers: { Authorization: `Bearer ${shipper.token}` }
  });
  const activeRows = (await activeRes.json())?.data || [];
  const activeForLoad = activeRows.filter(
    (r) => String(r.loadId || '') === String(loadId) || String(r.id || '') === String(loadId)
  ).length;

  const pass = dbCount === 1 || (dbCount === null && success >= 1 && success + conflict === CONCURRENT);
  const dbPass = dbCount === null || dbCount === 1;

  const artifact = writeArtifact('bid-stress', {
    pass: pass && dbPass,
    loadId,
    concurrent: CONCURRENT,
    elapsedMs: elapsed,
    success,
    conflict,
    dbCount,
    activeForLoad,
    statusHistogram: results.reduce((acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    }, {})
  });

  console.log(
    `${pass && dbPass ? 'PASS' : 'FAIL'} [bid-stress] success=${success} conflict=${conflict} dbCount=${dbCount} activeCards=${activeForLoad} ${elapsed}ms`
  );
  console.log('artifact:', artifact);
  process.exit(pass && dbPass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
