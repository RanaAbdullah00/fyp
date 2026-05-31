/**
 * Shared deploy-chain utilities — monorepo (fyp) → backend/frontend deploy repos.
 */
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const MONOREPO_ROOT = path.join(__dirname, '..', '..');
export const MANIFEST_PATH = path.join(MONOREPO_ROOT, 'deploy', 'manifest.json');
export const LOCK_PATH = path.join(MONOREPO_ROOT, 'deploy', '.sync-lock.json');
export const STATE_PATH = path.join(MONOREPO_ROOT, 'deploy', '.sync-state.json');

export const DEFAULT_API_ORIGIN = 'https://transpak-backend-1.onrender.com';
/** Canonical production URL — preview *.pages.dev hashes are ephemeral and must not gate deploy-chain. */
export const PRODUCTION_FRONTEND_URL = 'https://transpak-frontend.pages.dev';
export const DEFAULT_FRONTEND_URLS = [PRODUCTION_FRONTEND_URL];

export const DEPLOY_BACKEND_REPO =
  process.env.DEPLOY_BACKEND_REPO || 'RanaAbdullah00/transpak-backend';
export const DEPLOY_FRONTEND_REPO =
  process.env.DEPLOY_FRONTEND_REPO || 'RanaAbdullah00/transpak-frontend';

const CONTENT_EXCLUDE = new Set([
  'node_modules',
  'dist',
  '.git',
  '.env',
  'uploads',
  'coverage',
  '.render-build-stamp.json',
  'package-lock.json'
]);

export function normalizeCommit(hash) {
  if (!hash) return '';
  const h = String(hash).trim().toLowerCase();
  if (!h || h === 'unknown' || h === 'local') return h;
  return h.slice(0, 12);
}

export function commitsMatch(a, b) {
  const na = normalizeCommit(a);
  const nb = normalizeCommit(b);
  if (!na || !nb || na === 'unknown' || nb === 'unknown') return false;
  return na === nb;
}

export function exec(cmd, cwd, { inherit = false, allowFail = false } = {}) {
  try {
    if (inherit) {
      execSync(cmd, { cwd, stdio: 'inherit' });
      return '';
    }
    return execSync(cmd, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    }).trim();
  } catch (err) {
    if (allowFail) return '';
    throw err;
  }
}

export function gitRevParse(cwd, { short = false } = {}) {
  const flag = short ? '--short=12' : 'HEAD';
  return exec(`git rev-parse ${flag}`, cwd);
}

export function hasGit(cwd) {
  try {
    exec('git rev-parse --git-dir', cwd);
    return true;
  } catch {
    return false;
  }
}

export function gitStatusPorcelain(cwd) {
  return exec('git status --porcelain', cwd, { allowFail: true });
}

export function listTrackedFiles(monorepoRoot, prefix) {
  const normalized = prefix.replace(/\\/g, '/').replace(/\/$/, '');
  try {
    const out = exec(`git ls-files "${normalized}"`, monorepoRoot);
    if (!out) return [];
    return out
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((rel) => rel.slice(normalized.length + 1))
      .filter((rel) => rel && !rel.startsWith('../'));
  } catch {
    return [];
  }
}

export function contentHashForSubtree(monorepoRoot, prefix) {
  const files = listTrackedFiles(monorepoRoot, prefix);
  const h = createHash('sha256');
  for (const rel of files.sort()) {
    const parts = rel.split('/');
    if (parts.some((p) => CONTENT_EXCLUDE.has(p))) continue;
    if (rel.endsWith('.env') || rel.includes('.env.')) continue;
    const abs = path.join(monorepoRoot, prefix, rel);
    if (!fs.existsSync(abs) || fs.statSync(abs).isDirectory()) continue;
    h.update(rel);
    h.update('\0');
    h.update(fs.readFileSync(abs));
    h.update('\0');
  }
  return h.digest('hex').slice(0, 16);
}

export function readAssetFingerprint(frontendDir) {
  const indexPath = path.join(frontendDir, 'dist', 'index.html');
  if (!fs.existsSync(indexPath)) return null;
  const html = fs.readFileSync(indexPath, 'utf8');
  const bundle = html.match(/assets\/index-([A-Za-z0-9_-]+)\.js/);
  const meta = html.match(/name="transpak-build"\s+content="([^"]+)"/);
  return {
    mainJs: bundle ? bundle[1] : null,
    buildMeta: meta ? meta[1] : null
  };
}

export function loadManifest() {
  try {
    return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  } catch {
    return null;
  }
}

export function saveManifest(manifest) {
  fs.mkdirSync(path.dirname(MANIFEST_PATH), { recursive: true });
  fs.writeFileSync(`${MANIFEST_PATH}`, `${JSON.stringify(manifest, null, 2)}\n`);
}

export function writeLock(data) {
  fs.mkdirSync(path.dirname(LOCK_PATH), { recursive: true });
  fs.writeFileSync(LOCK_PATH, `${JSON.stringify({ ...data, at: new Date().toISOString() }, null, 2)}\n`);
}

export function clearLock() {
  try {
    fs.unlinkSync(LOCK_PATH);
  } catch {
    /* ignore */
  }
}

export function writeSyncState(state) {
  fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
  fs.writeFileSync(STATE_PATH, `${JSON.stringify({ ...state, at: new Date().toISOString() }, null, 2)}\n`);
}

export function authGitUrl(repo) {
  const token = String(process.env.DEPLOY_GITHUB_TOKEN || process.env.GITHUB_TOKEN || '').trim();
  if (token) return `https://x-access-token:${token}@github.com/${repo}.git`;
  return `https://github.com/${repo}.git`;
}

export async function fetchJson(url, headers = {}) {
  const res = await fetch(url, { cache: 'no-store', headers });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { ok: res.ok, status: res.status, body, headers: res.headers };
}

export async function fetchRenderHealth(apiOrigin = DEFAULT_API_ORIGIN) {
  const origin = apiOrigin.replace(/\/api\/?.*$/i, '').replace(/\/$/, '');
  const { ok, body } = await fetchJson(`${origin}/api/health`);
  const data = body?.data || {};
  const deploy = data.deploy || {};
  const commitFull =
    deploy.commitFull || data.commitFull || data.build || data.commit || '';
  return {
    ok,
    origin,
    commitFull,
    normalized: normalizeCommit(commitFull),
    db: data.db,
    schemaOk: data.schema?.ok === true,
    socketEngine: data.socketEngine || (data.sockets != null ? 'ready' : 'unknown'),
    raw: body
  };
}

export async function fetchFrontendHtml(url) {
  const res = await fetch(url, {
    cache: 'no-store',
    headers: { Accept: 'text/html', 'Cache-Control': 'no-cache' }
  });
  const html = await res.text();
  const bundle = html.match(/assets\/index-([A-Za-z0-9_-]+)\.js/);
  const meta = html.match(/name="transpak-build"\s+content="([^"]+)"/);
  return {
    url,
    status: res.status,
    cfCache: res.headers.get('cf-cache-status'),
    mainJs: bundle ? bundle[1] : null,
    buildMeta: meta ? meta[1] : null,
    html
  };
}

export async function fetchGitHubHead(repo, token) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'transpak-deploy-chain'
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const { ok, body } = await fetchJson(`https://api.github.com/repos/${repo}/commits/main`, headers);
  if (!ok) return { ok: false, sha: null, error: body };
  return { ok: true, sha: body?.sha || null, short: normalizeCommit(body?.sha) };
}

export function buildManifest({
  fypSha,
  backendSha,
  frontendSha,
  backendHash,
  frontendHash,
  assetFingerprint,
  chainStatus = 'synced'
}) {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    chainStatus,
    fyp: {
      sha: fypSha,
      short: normalizeCommit(fypSha)
    },
    backend: {
      repo: DEPLOY_BACKEND_REPO,
      repoSha: backendSha,
      short: normalizeCommit(backendSha),
      contentHash: backendHash
    },
    frontend: {
      repo: DEPLOY_FRONTEND_REPO,
      repoSha: frontendSha,
      short: normalizeCommit(frontendSha),
      contentHash: frontendHash,
      assetFingerprint: assetFingerprint?.mainJs || null,
      buildMeta: assetFingerprint?.buildMeta || null
    },
    live: {
      apiOrigin: DEFAULT_API_ORIGIN,
      frontendUrls: DEFAULT_FRONTEND_URLS,
      lastVerifiedAt: null
    }
  };
}

export function isManifestCurrent(manifest, fypSha, backendHash, frontendHash) {
  if (!manifest?.fyp?.sha || !manifest?.backend?.contentHash || !manifest?.frontend?.contentHash) {
    return false;
  }
  if (
    manifest.fyp.sha !== fypSha ||
    manifest.backend.contentHash !== backendHash ||
    manifest.frontend.contentHash !== frontendHash ||
    manifest.chainStatus !== 'synced'
  ) {
    return false;
  }
  for (const sub of ['transpak-backend', 'transpak-frontend']) {
    const dir = path.join(MONOREPO_ROOT, sub);
    if (hasGit(dir) && gitStatusPorcelain(dir)) return false;
  }
  return true;
}
