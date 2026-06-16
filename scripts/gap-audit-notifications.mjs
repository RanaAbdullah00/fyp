#!/usr/bin/env node
import { loadEnv, login, dbQuery, writeArtifact } from './gap-audit-utils.mjs';

async function main() {
  const env = loadEnv();
  const carrier = await login(env.API, env.CARRIER, env.PASS, 'carrier');
  const admin = await login(env.API, env.ADMIN, env.PASS, 'admin');
  if (!carrier.token) {
    console.error('FAIL: login');
    process.exit(1);
  }

  const unreadBefore = await fetch(`${env.API}/api/notifications/unread-count`, {
    headers: { Authorization: `Bearer ${carrier.token}` }
  });
  const unreadBeforeCount = (await unreadBefore.json())?.data?.count ?? 0;

  let dedupePass = true;
  let dedupeDetail = { skipped: true };
  if (process.env.DATABASE_URL && carrier.user?.id) {
    const eventId = `gap-audit-dedupe-${Date.now()}`;
    const receiverId = carrier.user.id;
    const dedupeKey = `gap:${eventId}`;
    try {
      await dbQuery(
        `INSERT INTO notifications (receiver_id, title, message, read, event_id, dedupe_key, role_type)
         VALUES ($1, 'GAP dedupe A', 'test', false, $2, $3, 'carrier')`,
        [receiverId, eventId, dedupeKey]
      );
      await dbQuery(
        `INSERT INTO notifications (receiver_id, title, message, read, event_id, dedupe_key, role_type)
         VALUES ($1, 'GAP dedupe B', 'test', false, $2, $3, 'carrier')
         ON CONFLICT DO NOTHING`,
        [receiverId, eventId, dedupeKey]
      ).catch(() => null);

      const { rows } = await dbQuery(
        `SELECT COUNT(*)::int AS c FROM notifications WHERE receiver_id = $1 AND event_id = $2`,
        [receiverId, eventId]
      );
      const count = rows[0]?.c ?? 0;
      dedupePass = count <= 1;
      dedupeDetail = { eventId, count, note: 'DB insert probe; unique constraint may vary' };

      await dbQuery(`DELETE FROM notifications WHERE receiver_id = $1 AND event_id = $2`, [
        receiverId,
        eventId
      ]);
    } catch (err) {
      const { rows } = await dbQuery(
        `SELECT event_id, COUNT(*)::int AS c
         FROM notifications
         WHERE event_id IS NOT NULL
         GROUP BY event_id
         HAVING COUNT(*) > 1
         LIMIT 3`
      );
      dedupePass = rows.length === 0;
      dedupeDetail = { fallback: 'no duplicate event_id groups', duplicates: rows };
    }
  }

  const listRes = await fetch(`${env.API}/api/notifications?limit=5`, {
    headers: { Authorization: `Bearer ${carrier.token}` }
  });
  const listBody = await listRes.json();
  const items = listBody?.data?.items || listBody?.data || [];
  const ids = items.map((n) => n.id);
  const listDedupe = ids.length === new Set(ids).size;

  let markReadPass = true;
  let markReadDetail = 'skipped';
  const target = items.find((n) => !n.read) || items[0];
  if (target?.id) {
    const mark = await fetch(`${env.API}/api/notifications/${target.id}/read`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${carrier.token}` }
    });
    const after = await fetch(`${env.API}/api/notifications?limit=20`, {
      headers: { Authorization: `Bearer ${carrier.token}` }
    });
    const afterBody = await after.json();
    const afterItems = afterBody?.data?.items || afterBody?.data || [];
    const found = afterItems.find((n) => n.id === target.id);
    markReadPass = mark.ok && found && found.read === true;
    markReadDetail = { markStatus: mark.status, persistedRead: found?.read };
  }

  let adminMarkPass = true;
  if (admin.token) {
    const adminNotifs = await fetch(`${env.API}/api/admin/notifications`, {
      headers: { Authorization: `Bearer ${admin.token}` }
    });
    const adminItems = (await adminNotifs.json())?.data || [];
    const first = adminItems[0];
    if (first?.id) {
      const mark = await fetch(`${env.API}/api/admin/notifications/${first.id}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${admin.token}` }
      });
      adminMarkPass = mark.ok;
    }
  }

  const syncRes = await fetch(`${env.API}/api/notifications/sync?limit=10`, {
    headers: { Authorization: `Bearer ${carrier.token}` }
  });
  const syncOk = syncRes.ok;

  const pass = dedupePass && listDedupe && markReadPass && adminMarkPass && syncOk;
  const artifact = writeArtifact('notifications', {
    pass,
    dedupePass,
    dedupeDetail,
    listDedupe,
    markReadPass,
    markReadDetail,
    adminMarkPass,
    syncOk,
    unreadBeforeCount
  });

  console.log(
    `${pass ? 'PASS' : 'FAIL'} [notifications] dedupe=${dedupePass} listDedupe=${listDedupe} markRead=${markReadPass} sync=${syncOk}`
  );
  console.log('artifact:', artifact);
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
