import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const backendRoot = path.join(root, 'transpak-backend');
const require = createRequire(path.join(backendRoot, 'package.json'));

export function loadEnv() {
  require('dotenv').config({ path: path.join(backendRoot, '.env') });
  return {
    API: (process.env.QA_BASE_URL || process.env.VITE_API_URL || 'https://transpak-backend-1.onrender.com')
      .replace(/\/api\/?.*$/i, '')
      .replace(/\/$/, ''),
    PASS: process.env.PHASE1_RBAC_PASSWORD || '',
    SHIPPER: process.env.E2E_SHIPPER_ONLY_EMAIL || 'transpak.phase1.shipper@example.com',
    CARRIER: process.env.E2E_CARRIER_ONLY_EMAIL || 'transpak.phase1.carrier@example.com',
    ADMIN: process.env.E2E_ADMIN_ONLY_EMAIL || 'transpak.phase1.admin@example.com',
    PREVIEW_ORIGIN:
      process.env.CLOUDFLARE_PAGES_URL ||
      process.env.VITE_FRONTEND_URL ||
      'https://910b6159.transpak-frontend.pages.dev',
    FRONTEND: (process.env.VITE_FRONTEND_URL || 'https://transpak-frontend.pages.dev').replace(/\/$/, '')
  };
}

export async function login(API, email, password, role) {
  const res = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, roleHint: role })
  });
  const body = await res.json();
  return { status: res.status, token: body?.data?.token, user: body?.data?.user, body };
}

export function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, idx))];
}

export function writeArtifact(name, data) {
  const outDir = path.join(root, 'deploy');
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, `gap-audit-${name}.json`);
  fs.writeFileSync(file, JSON.stringify({ at: new Date().toISOString(), ...data }, null, 2));
  return file;
}

export async function dbQuery(sql, params = []) {
  const { query, endPool } = require(path.join(backendRoot, 'db', 'pool.js'));
  try {
    return await query(sql, params);
  } finally {
    await endPool();
  }
}
