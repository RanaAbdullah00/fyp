#!/usr/bin/env node
/**
 * Post-deploy browser audit — console + mobile viewports (Phases 8–9).
 * Usage: node scripts/post-deploy-browser-audit.mjs
 * Requires: npx playwright install chromium (one-time)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const backendRoot = path.join(root, 'transpak-backend');
const require = createRequire(path.join(backendRoot, 'package.json'));
require('dotenv').config({ path: path.join(backendRoot, '.env') });

const FRONTEND = (process.env.VITE_FRONTEND_URL || 'https://transpak-frontend.pages.dev').replace(/\/$/, '');
const API = (process.env.QA_BASE_URL || 'https://transpak-backend-1.onrender.com').replace(/\/$/, '');
const PASS = process.env.PHASE1_RBAC_PASSWORD || process.env.E2E_SHIPPER_PASSWORD || '';
const SHIPPER = process.env.E2E_SHIPPER_ONLY_EMAIL || 'transpak.phase1.shipper@example.com';
const ADMIN = process.env.E2E_ADMIN_ONLY_EMAIL || 'transpak.phase1.admin@example.com';

const VIEWPORTS = [
  { name: '320px', width: 320, height: 640 },
  { name: '375px', width: 375, height: 812 },
  { name: '768px', width: 768, height: 1024 },
  { name: '1024px', width: 1024, height: 768 }
];

const ROUTES = [
  { path: '/login', label: 'login', auth: false },
  { path: '/dashboard/shipper', label: 'shipper-dashboard', auth: 'shipper' },
  { path: '/loads/manage', label: 'loads-manage', auth: 'shipper' },
  { path: '/bids/mine', label: 'my-bids', auth: 'carrier' },
  { path: '/admin/dashboard', label: 'admin-dashboard', auth: 'admin' },
  { path: '/shipments/history', label: 'shipment-history', auth: 'shipper' }
];

/** @type {Array<Record<string, unknown>>} */
const results = [];

async function getToken(email, roleHint) {
  const res = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASS, roleHint })
  });
  const body = await res.json();
  return body?.data?.token;
}

async function main() {
  let chromium;
  try {
    const feRequire = createRequire(path.join(root, 'transpak-frontend', 'package.json'));
    const pwPath = feRequire.resolve('playwright');
    ({ chromium } = await import(pwPath));
  } catch {
    console.error('Playwright not installed. Run: cd transpak-frontend && npx playwright install chromium');
    process.exit(2);
  }

  const shipperToken = await getToken(SHIPPER, 'shipper');
  const adminToken = await getToken(ADMIN, 'admin');
  const carrierToken = await getToken(
    process.env.E2E_CARRIER_ONLY_EMAIL || 'transpak.phase1.carrier@example.com',
    'carrier'
  );

  const browser = await chromium.launch({ headless: true });
  const consoleLog = [];

  for (const vp of VIEWPORTS) {
    for (const route of ROUTES) {
      const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      const page = await context.newPage();
      const errors = [];
      const warnings = [];
      const failedReqs = [];

      page.on('console', (msg) => {
        const text = msg.text();
        if (msg.type() === 'error') errors.push(text);
        if (msg.type() === 'warning' && /react|hydration|key/i.test(text)) warnings.push(text);
      });
      page.on('pageerror', (err) => errors.push(err.message));
      page.on('requestfailed', (req) => {
        const url = req.url();
        if (!url.includes('favicon') && !url.includes('tile')) {
          failedReqs.push(`${req.method()} ${url}`);
        }
      });

      let token = null;
      if (route.auth === 'shipper') token = shipperToken;
      if (route.auth === 'admin') token = adminToken;
      if (route.auth === 'carrier') token = carrierToken;

      if (token) {
        await context.addInitScript((t) => {
          localStorage.setItem('tp_token', t);
          localStorage.setItem('transpak_token', t);
        }, token);
      }

      const url = `${FRONTEND}${route.path}`;
      let status = 0;
      try {
        const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
        status = res?.status() ?? 0;
        await page.waitForTimeout(3000);
      } catch (e) {
        errors.push(`navigation: ${e.message}`);
      }

      const overflow = await page.evaluate(() => {
        const doc = document.documentElement;
        return doc.scrollWidth > doc.clientWidth + 2;
      });
      const rootText = await page.locator('#root').innerText().catch(() => '');
      const blank = rootText.trim().length < 20;

      const entry = {
        viewport: vp.name,
        route: route.path,
        label: route.label,
        httpStatus: status,
        blank,
        horizontalOverflow: overflow,
        consoleErrors: errors.slice(0, 10),
        reactWarnings: warnings.slice(0, 5),
        failedRequests: failedReqs.filter((u) => !u.includes('401')).slice(0, 5),
        pass: !blank && !overflow && errors.length === 0 && failedReqs.filter((u) => /\/api\//.test(u) && !u.includes('401')).length === 0
      };
      results.push(entry);
      console.log(`${entry.pass ? 'PASS' : 'FAIL'} [${vp.name}] ${route.path} blank=${blank} overflow=${overflow} errors=${errors.length}`);
      errors.forEach((e) => consoleLog.push({ viewport: vp.name, route: route.path, type: 'error', text: e }));
      await context.close();
    }
  }

  await browser.close();

  const outApi = path.join(root, 'deploy', 'post-deploy-audit-browser.json');
  const outConsole = path.join(root, 'deploy', 'post-deploy-audit-console.log');
  fs.mkdirSync(path.dirname(outApi), { recursive: true });
  fs.writeFileSync(outApi, JSON.stringify({ at: new Date().toISOString(), frontend: FRONTEND, results }, null, 2));
  fs.writeFileSync(outConsole, consoleLog.map((l) => JSON.stringify(l)).join('\n') || '# no console errors captured\n');

  const failed = results.filter((r) => !r.pass).length;
  console.log(`\nWrote ${outApi}`);
  console.log(`Wrote ${outConsole}`);
  console.log(`--- Browser audit: ${results.length - failed}/${results.length} passed ---`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
