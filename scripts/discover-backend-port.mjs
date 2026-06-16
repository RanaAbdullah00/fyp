#!/usr/bin/env node
/**
 * Discover local TransPak backend origin by probing /api/health.
 * Usage:
 *   node scripts/discover-backend-port.mjs [--print] [--json]
 * Exit 0 with origin on stdout when found; exit 1 when not found (local only).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const portFile = path.join(root, '.dev-backend-port');
const args = new Set(process.argv.slice(2));
const TIMEOUT_MS = Number(process.env.DISCOVER_BACKEND_TIMEOUT_MS || 8000);

function loadBackendEnv() {
  const p = path.join(root, 'transpak-backend', '.env');
  if (!fs.existsSync(p)) return {};
  const out = {};
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 1) continue;
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return out;
}

function buildPortCandidates(env = {}) {
  const merged = { ...loadBackendEnv(), ...env, ...process.env };
  const seen = new Set();
  const ports = [];
  const add = (p) => {
    const n = Number(p);
    if (!Number.isFinite(n) || n <= 0 || seen.has(n)) return;
    seen.add(n);
    ports.push(n);
  };
  add(merged.PORT);
  for (let p = 10000; p <= 10005; p += 1) add(p);
  add(5000);
  return ports;
}

async function probeHealth(host, port) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`http://${host}:${port}/api/health`, {
      signal: controller.signal,
      cache: 'no-store',
      headers: { Accept: 'application/json' }
    });
    if (!res.ok) return false;
    const body = await res.json();
    return body?.success === true || body?.data?.commit != null || body?.data?.schema != null;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export async function discoverBackendOrigin(options = {}) {
  const host = options.host || '127.0.0.1';
  const env = options.env || {};

  if (options.preferFile !== false && fs.existsSync(portFile)) {
    const fromFile = Number(String(fs.readFileSync(portFile, 'utf8')).trim());
    if (Number.isFinite(fromFile) && fromFile > 0 && (await probeHealth(host, fromFile))) {
      return `http://${host}:${fromFile}`;
    }
  }

  for (const port of buildPortCandidates(env)) {
    if (await probeHealth(host, port)) {
      return `http://${host}:${port}`;
    }
  }
  return null;
}

export function resolveApiOrigin(cliOrigin, env = {}) {
  const merged = { ...loadBackendEnv(), ...env, ...process.env };
  const raw =
    cliOrigin ||
    merged.VITE_API_URL ||
    merged.API_BASE_URL ||
    merged.QA_BASE_URL ||
    merged.TEST_BASE_URL ||
    merged.E2E_BASE_URL ||
    '';
  if (raw) {
    return String(raw)
      .replace(/\/api\/?.*$/i, '')
      .replace(/\/$/, '');
  }
  return null;
}

export async function resolveLocalApiOrigin(cliOrigin, env = {}) {
  const explicit = resolveApiOrigin(cliOrigin, env);
  if (explicit && !/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/i.test(explicit)) {
    return explicit;
  }
  const discovered = await discoverBackendOrigin({ env });
  if (discovered) return discovered;
  if (explicit) return explicit;
  const fallbackPort = Number(process.env.PORT || loadBackendEnv().PORT || 10000);
  return `http://127.0.0.1:${fallbackPort}`;
}

async function main() {
  const explicit = resolveApiOrigin(process.argv.find((a) => /^https?:\/\//i.test(a)), process.env);
  const origin = explicit || (await discoverBackendOrigin()) || null;
  if (!origin) {
    console.error('[discover-backend-port] No local backend found on PORT or 10000-10005');
    process.exit(1);
  }
  if (args.has('--json')) {
    console.log(JSON.stringify({ origin, port: Number(new URL(origin).port) || 80 }));
  } else {
    console.log(origin);
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
