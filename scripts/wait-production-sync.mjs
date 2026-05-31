#!/usr/bin/env node
/**
 * Poll production /api/health until Render commit matches expected deploy SHA (or timeout).
 * Expected SHA: argv[1] → manifest.backend.repoSha → nested backend HEAD.
 *
 * Usage: node scripts/wait-production-sync.mjs [expectedCommitShort]
 */
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadManifest, normalizeCommit } from './lib/deploy-chain.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..');
const API =
  (process.env.VITE_API_URL || 'https://transpak-backend-1.onrender.com').replace(/\/api\/?.*$/i, '').replace(/\/$/, '');

const manifest = loadManifest();

const expected =
  process.argv[2] ||
  manifest?.backend?.repoSha ||
  (() => {
    try {
      return execSync('git rev-parse --short=12 HEAD', {
        cwd: path.join(repoRoot, 'transpak-backend'),
        encoding: 'utf8'
      }).trim();
    } catch {
      return execSync('git rev-parse --short=12 HEAD', { cwd: repoRoot, encoding: 'utf8' }).trim();
    }
  })();

const maxAttempts = Number(process.env.WAIT_PRODUCTION_ATTEMPTS || 36);
const intervalMs = Number(process.env.WAIT_PRODUCTION_INTERVAL_MS || 20000);

function normalize(c) {
  return normalizeCommit(c);
}

const want = normalize(expected);

async function fetchRemote() {
  const res = await fetch(`${API}/api/health`, { cache: 'no-store' });
  const body = await res.json();
  const d = body?.data || {};
  const remote = normalize(d.deploy?.commitFull || d.commitFull || d.commit || d.build);
  return { remote, full: body, ok: d.db === 'ready' && d.schema?.ok === true };
}

console.log(`Waiting for production commit ${want} at ${API} …`);

for (let i = 1; i <= maxAttempts; i++) {
  try {
    const { remote, full, ok } = await fetchRemote();
    console.log(`[${i}/${maxAttempts}] remote=${remote} db=${full?.data?.db} schema=${full?.data?.schema?.ok}`);
    if (remote === want && ok) {
      console.log('PASS: production aligned with local commit.');
      process.exit(0);
    }
  } catch (err) {
    console.warn(`[${i}/${maxAttempts}] health fetch failed:`, err?.message || err);
  }
  if (i < maxAttempts) {
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

console.error(`TIMEOUT: production still not on commit ${want}. Trigger Render Manual Deploy + clear build cache.`);
process.exit(1);
