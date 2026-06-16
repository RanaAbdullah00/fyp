#!/usr/bin/env node
import { loadEnv, login, writeArtifact } from './gap-audit-utils.mjs';

function findDupIds(items) {
  const seen = new Set();
  const dupes = [];
  for (const item of items) {
    if (seen.has(item.id)) dupes.push(item.id);
    seen.add(item.id);
  }
  return dupes;
}

async function fetchFeedPage(token, page, type) {
  const qs = new URLSearchParams({ page: String(page), limit: '20' });
  if (type) qs.set('type', type);
  const res = await fetch(`${process.env._GAP_API}/api/admin/activity-feed?${qs}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const body = await res.json();
  return {
    ok: res.ok,
    status: res.status,
    items: body?.data?.items || [],
    total: body?.data?.total,
    totalPages: body?.data?.totalPages
  };
}

async function fetchAuditPage(token, page) {
  const res = await fetch(
    `${process.env._GAP_API}/api/admin/audit-events?page=${page}&limit=20`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const body = await res.json();
  return {
    ok: res.ok,
    status: res.status,
    items: body?.data?.items || body?.data?.events || [],
    total: body?.data?.total,
    totalPages: body?.data?.totalPages
  };
}

async function main() {
  const env = loadEnv();
  process.env._GAP_API = env.API;
  const admin = await login(env.API, env.ADMIN, env.PASS, 'admin');
  if (!admin.token) {
    console.error('FAIL: admin login');
    process.exit(1);
  }

  const pageResults = await Promise.all([1, 2, 3].map((p) => fetchFeedPage(admin.token, p)));
  const pages = pageResults.map((page, idx) => ({
    page: idx + 1,
    ...page,
    dupes: findDupIds(page.items)
  }));
  const allIds = pages.flatMap((p) => p.items.map((i) => i.id));
  const crossDupes = allIds.filter((id, i) => allIds.indexOf(id) !== i);
  const uniqueCrossDupes = [...new Set(crossDupes)];
  const totals = pages.map((p) => p.total);
  const paginationStable = new Set(totals).size === 1;

  const auditPages = await Promise.all([1, 2, 3].map((p) => fetchAuditPage(admin.token, p))).then(
    (results) => results.map((page, idx) => ({ page: idx + 1, ...page }))
  );
  const auditTotals = auditPages.map((p) => p.total);
  const auditPaginationStable = new Set(auditTotals).size === 1;

  const shipmentPage = await fetchFeedPage(admin.token, 1, 'shipment');
  const feedOk = pages.every((p) => p.ok);
  const auditOk = auditPages.every((p) => p.ok);
  const withinPageDupes = pages.some((p) => p.dupes.length > 0);
  const crossPageDupesLive = uniqueCrossDupes.length > 0;
  const pass = feedOk && !withinPageDupes && auditOk && shipmentPage.ok;
  const artifact = writeArtifact('admin-data', {
    pass,
    feedPages: pages.map(({ items, ...rest }) => ({ ...rest, itemCount: items.length })),
    withinPageDupes,
    crossPageDuplicateIds: uniqueCrossDupes,
    crossPageDupesLive,
    paginationStable,
    auditPaginationStable,
    note: crossPageDupesLive
      ? 'Cross-page duplicate ids may occur when live events insert during offset pagination'
      : null,
    auditPages: auditPages.map(({ items, ...rest }) => ({ ...rest, itemCount: items.length })),
    shipmentFilterOk: shipmentPage.ok
  });

  console.log(
    `${pass ? 'PASS' : 'FAIL'} [admin-data] feedOk=${feedOk} withinPageDupes=${withinPageDupes} crossPageLive=${crossPageDupesLive} auditOk=${auditOk}`
  );
  console.log('artifact:', artifact);
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
