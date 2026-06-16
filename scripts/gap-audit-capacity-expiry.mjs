#!/usr/bin/env node
import { loadEnv, login, dbQuery, writeArtifact } from './gap-audit-utils.mjs';

async function main() {
  const env = loadEnv();
  const shipper = await login(env.API, env.SHIPPER, env.PASS, 'shipper');
  const carrier = await login(env.API, env.CARRIER, env.PASS, 'carrier');
  if (!shipper.token || !carrier.token) {
    console.error('FAIL: login');
    process.exit(1);
  }

  const marketRes = await fetch(`${env.API}/api/carrier-space?status=open&limit=50`, {
    headers: { Authorization: `Bearer ${shipper.token}` }
  });
  const market = (await marketRes.json())?.data || [];

  const mineRes = await fetch(`${env.API}/api/carrier-space/mine`, {
    headers: { Authorization: `Bearer ${carrier.token}` }
  });
  const mine = (await mineRes.json())?.data || [];

  const closedInMarket = market.filter((l) => {
    const s = String(l.status || '').toLowerCase();
    return s === 'closed' || s === 'cancelled' || s === 'expired';
  });

  const closedMine = mine.filter((l) => String(l.status || '').toLowerCase() === 'closed');
  let reopenBlocked = null;
  const closedListing = closedMine[0];
  if (closedListing?.id) {
    const patch = await fetch(`${env.API}/api/carrier-space/${closedListing.id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${carrier.token}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `gap-cap-reopen-${closedListing.id}`
      },
      body: JSON.stringify({ status: 'open' })
    });
    const body = await patch.json().catch(() => ({}));
    reopenBlocked = {
      status: patch.status,
      code: body?.code || body?.errorCode,
      pass: patch.status === 409
    };
  }

  let expiredLoadsHidden = true;
  if (process.env.DATABASE_URL) {
    const { rows } = await dbQuery(
      `SELECT id, code, status::text FROM loads
       WHERE status IN ('cancelled', 'closed')
       AND cargo LIKE 'GAP_%'
       LIMIT 5`
    );
    for (const row of rows) {
      const inMarket = market.some((m) => String(m.id) === String(row.id));
      if (inMarket) expiredLoadsHidden = false;
    }
  }

  const pass =
    marketRes.ok &&
    mineRes.ok &&
    closedInMarket.length === 0 &&
    (reopenBlocked === null || reopenBlocked.pass) &&
    expiredLoadsHidden;

  const artifact = writeArtifact('capacity-expiry', {
    pass,
    marketCount: market.length,
    mineCount: mine.length,
    closedInMarket: closedInMarket.map((l) => l.id),
    reopenBlocked,
    expiredLoadsHidden
  });

  console.log(
    `${pass ? 'PASS' : 'FAIL'} [capacity-expiry] market=${market.length} closedInOpen=${closedInMarket.length} reopen=${reopenBlocked?.status ?? 'n/a'}`
  );
  console.log('artifact:', artifact);
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
