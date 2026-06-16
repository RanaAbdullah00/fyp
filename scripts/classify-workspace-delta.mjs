#!/usr/bin/env node
/**
 * Classify workspace delta into deploy waves (A/B/C + subsystem).
 * Usage: node scripts/classify-workspace-delta.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function gitLines(cmd) {
  try {
    return execSync(cmd, { cwd: root, encoding: 'utf8' })
      .trim()
      .split(/\r?\n/)
      .filter(Boolean);
  } catch {
    return [];
  }
}

const modified = gitLines('git diff --name-only HEAD');
const untracked = gitLines('git ls-files --others --exclude-standard');
const all = [...new Set([...modified, ...untracked])];

const CATEGORY_A = [
  /^scripts\/(gate-|gap-audit|release-gate|release-blocker|stabilization|behavioral|pre-presentation|smoke-|discover-|post-deploy|wait-|verify-|check-)/,
  /^transpak-backend\/test\//,
  /^transpak-backend\/scripts\/(validate-|notification-|db-integrity|phase.*validation)/,
  /^deploy\/(MASTER-|GAP-|gap-audit|notification-|release-blocker|\.sync-state|manifest)/,
  /^docs\//,
  /^\.gitignore$/,
  /^package\.json$/,
  /^POST-DEPLOY|^PRODUCTION-/,
  /^scripts\/classify-workspace-delta\.mjs$/
];

const CATEGORY_C = [
  /^transpak-backend\/db\/migrations\//,
  /^transpak-backend\/db\/(schemaGuard|migrate)\.js$/,
  /^transpak-backend\/controllers\/authController\.js$/,
  /^transpak-backend\/middleware\/authMiddleware\.js$/,
  /^transpak-backend\/routes\/(bidRoutes|shipmentRoutes|notificationRoutes)\.js$/,
  /^transpak-backend\/utils\/(notifyEvent|notifyUnified|bidAcceptance|bidRealtime)\.js$/,
  /^transpak-backend\/sockets\//,
  /^transpak-backend\/src\/server\.js$/
];

const WAVES = {
  W1_validation: [
    /^scripts\/gate-/,
    /^scripts\/gap-audit/,
    /^scripts\/release-gate/,
    /^transpak-backend\/test\//,
    /^transpak-backend\/scripts\/(validate-|db-integrity|notification-dedupe|notification-hardening)/
  ],
  W2_notifications: [/notification/i, /notify/i, /Notification/],
  W3_bids: [/bid/i, /Bid/, /loadboard/],
  W4_shipments_tracking: [/shipment/i, /Shipment/, /tracking/i, /Tracking/, /activeShipment/],
  W5_capacity: [/capacity/i, /Capacity/, /carrierSpace/, /carrier-space/, /spaceBooking/, /spaceRequest/],
  W6_auth_admin: [/auth/i, /Auth/, /admin/i, /Admin/, /rbac/i, /profileController/],
  W7_enterprise: [/causal/i, /trace/i, /replay/i, /distributed/i, /enterprise/, /chaos/, /metricsRoutes/]
};

function categoryOf(f) {
  const norm = f.replace(/\\/g, '/');
  if (CATEGORY_A.some((re) => re.test(norm))) return 'A';
  if (CATEGORY_C.some((re) => re.test(norm))) return 'C';
  return 'B';
}

function waveOf(f) {
  const norm = f.replace(/\\/g, '/');
  for (const [wave, patterns] of Object.entries(WAVES)) {
    if (patterns.some((re) => re.test(norm))) return wave;
  }
  return 'W7_remaining';
}

const byCategory = { A: [], B: [], C: [] };
const byWave = {};
for (const f of all) {
  const cat = categoryOf(f);
  byCategory[cat].push(f);
  const w = waveOf(f);
  (byWave[w] ||= []).push(f);
}

const report = {
  at: new Date().toISOString(),
  head: gitLines('git rev-parse HEAD')[0] || null,
  counts: {
    modified: modified.length,
    untracked: untracked.length,
    total: all.length,
    A: byCategory.A.length,
    B: byCategory.B.length,
    C: byCategory.C.length
  },
  byCategory,
  byWave: Object.fromEntries(
    Object.entries(byWave)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => [k, { count: v.length, files: v.sort() }])
  ),
  productionRisk: {
    categoryC: byCategory.C.sort(),
    note: 'Category C requires isolated wave gates before production sync'
  }
};

const out = path.join(root, 'deploy', 'DELTA-CLASSIFICATION.json');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report.counts, null, 2));
console.log('artifact:', out);
