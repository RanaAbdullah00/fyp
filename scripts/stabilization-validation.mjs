#!/usr/bin/env node
/**
 * Production stabilization loop — local static + live API checks.
 * Usage: node scripts/stabilization-validation.mjs [apiOrigin]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getRequiredSchemaVersion, isSchemaVersionAtLeast } from './gate-schema-policy.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const feRoot = path.join(root, 'transpak-frontend');
const apiOrigin = (process.argv[2] || process.env.VITE_API_URL || 'https://transpak-backend-1.onrender.com')
  .replace(/\/api\/?.*$/i, '')
  .replace(/\/$/, '');

const phases = [];

function phase(name, pass, detail) {
  phases.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'} [${name}] ${detail}`);
}

function read(rel) {
  return fs.readFileSync(path.join(feRoot, rel), 'utf8');
}

function fileExists(rel) {
  return fs.existsSync(path.join(feRoot, rel));
}

async function main() {
  console.log('\n=== TransPak Stabilization Validation ===\n');

  // Phase 1 — deployment files
  phase(
    'P1-local-engine',
    fileExists('src/utils/stateNormalizationEngine.js'),
    'stateNormalizationEngine.js present'
  );
  phase(
    'P1-local-review-guard',
    fileExists('src/utils/reviewRenderGuard.js'),
    'reviewRenderGuard.js present'
  );
  phase(
    'P1-local-admin-smart',
    fileExists('src/utils/adminSmartLogin.js'),
    'adminSmartLogin.js present'
  );

  const loginForm = read('src/components/auth/LoginForm.jsx');
  phase(
    'P7-admin-whitelist-redirect',
    loginForm.includes('smartAdmin && canAccessAdminRoutes'),
    'whitelist-only admin redirect'
  );
  phase(
    'P7-hide-role-selector',
    loginForm.includes('!smartAdmin ? <RoleSelector'),
    'RoleSelector hidden for smart admin email'
  );

  const asc = read('src/components/dashboard/ActiveShipmentCard.jsx');
  const tracking = read('src/pages/shipments/ShipmentTracking.jsx');
  phase(
    'P2-engine-wired',
    asc.includes('getNextAllowedActions') && tracking.includes('getNextAllowedActions'),
    'ActiveShipmentCard + ShipmentTracking use engine'
  );

  const reviewHost = read('src/components/reviews/ReviewPromptHost.jsx');
  phase(
    'P3-review-guard',
    reviewHost.includes('reviewRenderGuard') && reviewHost.includes('canRenderReview'),
    'ReviewPromptHost uses render guard'
  );

  const historyFetch = read('src/utils/shipmentHistoryFetch.js');
  phase(
    'P4-history-cache',
    historyFetch.includes('loadHistoryCache') && historyFetch.includes('saveHistoryCache'),
    'history session cache helpers'
  );

  const loadsHub = read('src/pages/loads/LoadsHub.jsx');
  phase(
    'P5-capacity-layout',
    loadsHub.includes('marketplace') && loadsHub.includes('openLoadsTab') && loadsHub.includes('availableCapacityTab'),
    'LoadsHub marketplace subtabs'
  );

  const grepProfileLink = (dir) => {
    let count = 0;
    const walk = (p) => {
      for (const ent of fs.readdirSync(p, { withFileTypes: true })) {
        const full = path.join(p, ent.name);
        if (ent.isDirectory() && ent.name !== 'node_modules') walk(full);
        else if (ent.isFile() && /\.(jsx|js)$/.test(ent.name)) {
          const rel = path.relative(feRoot, full).replace(/\\/g, '/');
          if (rel === 'src/components/profile/ProfileLink.jsx') return;
          if (rel === 'src/components/profile/ProfileAccessLayer.jsx') return;
          const src = fs.readFileSync(full, 'utf8');
          if (/import ProfileLink from/.test(src)) count += 1;
        }
      }
    };
    walk(path.join(feRoot, dir));
    return count;
  };
  const directProfileLinkImports = grepProfileLink('src');
  phase(
    'P6-profile-layer',
    directProfileLinkImports === 0,
    directProfileLinkImports === 0
      ? 'no direct ProfileLink imports outside layer'
      : `${directProfileLinkImports} files still import ProfileLink directly`
  );

  // Live API
  let health;
  try {
    const res = await fetch(`${apiOrigin}/api/health`, { cache: 'no-store' });
    health = await res.json();
    const d = health?.data || {};
    phase('P1-backend-up', res.ok, `commit=${d.commit || '?'} schema=${d.schema?.version || '?'}`);
    const requiredSchema = getRequiredSchemaVersion();
    phase(
      'P1-schema-version',
      isSchemaVersionAtLeast(d.schema?.version, requiredSchema),
      `live schema ${d.schema?.version || '?'} (required >= ${requiredSchema})`
    );
    phase('P1-migration-safe', d.deploy?.migrationSafe === true, `migrationSafe=${d.deploy?.migrationSafe}`);
  } catch (e) {
    phase('P1-backend-up', false, e.message);
  }

  try {
    const res = await fetch(`${apiOrigin}/api/system/policy-health`, { cache: 'no-store' });
    const body = await res.json();
    phase(
      'P8-policy-health',
      body?.systemDrift === false || body?.data?.runtimeDrift?.systemDrift === false,
      `systemDrift=${body?.systemDrift ?? body?.data?.runtimeDrift?.systemDrift}`
    );
  } catch (e) {
    phase('P8-policy-health', false, e.message);
  }

  const failed = phases.filter((p) => !p.pass);
  console.log(`\n--- Summary: ${phases.length - failed.length}/${phases.length} passed ---`);
  if (failed.length) {
    console.log('Pending (deploy or fix):');
    for (const f of failed) console.log(`  - ${f.name}: ${f.detail}`);
  }
  process.exit(failed.some((f) => f.name.startsWith('P1-backend')) ? 1 : 0);
}

main();
