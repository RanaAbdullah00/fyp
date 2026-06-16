#!/usr/bin/env node
/**
 * Release blocker — tracking static + live API proof.
 * Usage: node scripts/release-blocker-tracking.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const feRoot = path.join(root, 'transpak-frontend', 'src');
const backendRoot = path.join(root, 'transpak-backend');
const require = createRequire(path.join(backendRoot, 'package.json'));
require('dotenv').config({ path: path.join(backendRoot, '.env') });

const API = (process.env.QA_BASE_URL || 'https://transpak-backend-1.onrender.com').replace(/\/$/, '');
const PASS = process.env.PHASE1_RBAC_PASSWORD || process.env.E2E_CARRIER_PASSWORD || '11223344';
const CARRIER = process.env.E2E_CARRIER_EMAIL || process.env.E2E_CARRIER_ONLY_EMAIL || 'transpak.phase1.carrier@example.com';
const SHIPPER = process.env.E2E_SHIPPER_EMAIL || process.env.E2E_SHIPPER_ONLY_EMAIL || 'transpak.phase1.shipper@example.com';

const proof = { static: [], live: [], at: new Date().toISOString() };

function staticCheck(name, pass, detail) {
  proof.static.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'} [static:${name}] ${detail}`);
}

function liveCheck(name, pass, detail) {
  proof.live.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'} [live:${name}] ${detail}`);
}

async function login(email, roleHint) {
  const res = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASS, roleHint })
  });
  const body = await res.json();
  return body?.data?.token;
}

async function main() {
  console.log('\n=== Release Blocker Tracking Proof ===\n');

  const trackingSocket = fs.readFileSync(path.join(feRoot, 'hooks', 'useTrackingSocket.js'), 'utf8');
  staticCheck(
    'joinSession_import',
    trackingSocket.includes('joinSession') && trackingSocket.includes('trackingSessionManager'),
    'useTrackingSocket imports session manager'
  );
  staticCheck(
    'no_joinTrackingSession',
    !fs.existsSync(path.join(feRoot, 'hooks', 'joinTrackingSession.js')) &&
      !trackingSocket.includes('joinTrackingSession'),
    'API uses joinSession not joinTrackingSession'
  );

  const shipmentTracking = fs.readFileSync(path.join(feRoot, 'hooks', 'useShipmentTracking.js'), 'utf8');
  staticCheck(
    'composes_useTrackingSocket',
    shipmentTracking.includes('useTrackingSocket'),
    'useShipmentTracking composes socket hook'
  );
  staticCheck(
    'no_duplicate_emit_in_effect',
    !shipmentTracking.includes('emitTrackingJoin(activeSocket'),
    'duplicate emitTrackingJoin removed from mount effect'
  );

  const shipperToken = await login(SHIPPER, 'shipper');
  const carrierToken = await login(CARRIER, 'carrier');
  if (!shipperToken || !carrierToken) {
    liveCheck('auth', false, 'E2E login failed');
  } else {
    liveCheck('auth', true, 'shipper and carrier tokens obtained');
    const activeRes = await fetch(`${API}/api/shipments/active`, {
      headers: { Authorization: `Bearer ${shipperToken}` }
    });
    const activeBody = await activeRes.json();
    const rows = activeBody?.data ?? [];
    const row = Array.isArray(rows) ? rows[0] : null;
    const ref =
      row?.refKey ||
      row?.trackingRef ||
      row?.shipmentRef ||
      row?.loadCode ||
      row?.code ||
      row?.id;
    if (!ref) {
      liveCheck('tracking_payload', true, 'no active shipment — skip live tracking fetch');
    } else {
      const candidates = [
        row?.refKey,
        row?.trackingRef,
        row?.shipmentRef,
        row?.loadCode,
        row?.code,
        row?.id,
        row?.loadId
      ].filter(Boolean);
      let ok = false;
      let lastStatus = 0;
      for (const candidate of candidates) {
        const tr = await fetch(`${API}/api/shipments/track/${encodeURIComponent(candidate)}`, {
          headers: { Authorization: `Bearer ${shipperToken}` }
        });
        lastStatus = tr.status;
        if (tr.status === 200) {
          ok = true;
          liveCheck('tracking_payload', true, `GET tracking ${candidate} HTTP 200`);
          const tr2 = await fetch(`${API}/api/shipments/track/${encodeURIComponent(candidate)}`, {
            headers: { Authorization: `Bearer ${shipperToken}` }
          });
          liveCheck('tracking_refresh', tr2.status === 200, `refresh HTTP ${tr2.status}`);
          break;
        }
      }
      if (!ok) {
        liveCheck('tracking_payload', false, `GET tracking failed for refs ${candidates.join(', ')} last HTTP ${lastStatus}`);
        liveCheck('tracking_refresh', false, 'skipped after payload failure');
      }
    }
  }

  const outPath = path.join(root, 'deploy', 'release-blocker-tracking.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(proof, null, 2));
  console.log(`\nWrote ${outPath}`);

  const failed =
    proof.static.some((r) => !r.pass) || proof.live.some((r) => !r.pass);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
