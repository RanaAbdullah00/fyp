#!/usr/bin/env node
/**
 * Idempotent, SHA-verified sync: fyp monorepo → transpak-backend + transpak-frontend deploy repos.
 *
 * Local: uses nested .git in transpak-backend / transpak-frontend.
 * CI (--ci): clones deploy repos, copies monorepo subtrees, commits, pushes (atomic best-effort).
 *
 * Usage:
 *   node scripts/sync-deploy-repos.mjs [--backend] [--frontend] [--dry-run] [--ci] [--force] [--check-only]
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  MONOREPO_ROOT,
  LOCK_PATH,
  DEPLOY_BACKEND_REPO,
  DEPLOY_FRONTEND_REPO,
  authGitUrl,
  buildManifest,
  clearLock,
  commitsMatch,
  contentHashForSubtree,
  exec,
  fetchGitHubHead,
  gitRevParse,
  gitStatusPorcelain,
  hasGit,
  isManifestCurrent,
  loadManifest,
  normalizeCommit,
  readAssetFingerprint,
  saveManifest,
  writeLock,
  writeSyncState
} from './lib/deploy-chain.mjs';

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const ciMode = args.has('--ci');
const force = args.has('--force');
const checkOnly = args.has('--check-only');
const doBackend = args.has('--backend') || (!args.has('--frontend') && !args.has('--backend'));
const doFrontend = args.has('--frontend') || (!args.has('--frontend') && !args.has('--backend'));

const BACKEND_SRC = path.join(MONOREPO_ROOT, 'transpak-backend');
const FRONTEND_SRC = path.join(MONOREPO_ROOT, 'transpak-frontend');

const COPY_EXCLUDE = new Set([
  'node_modules',
  'dist',
  '.git',
  '.env',
  'uploads',
  'coverage',
  '.render-build-stamp.json'
]);

function log(msg) {
  console.log(msg);
}

function run(cmd, cwd) {
  log(`> ${cmd}\n  (cwd: ${cwd})`);
  if (dryRun) return '';
  return exec(cmd, cwd, { inherit: true });
}

async function copyTree(src, dest) {
  await fs.promises.mkdir(dest, { recursive: true });
  const entries = await fs.promises.readdir(src, { withFileTypes: true });
  for (const ent of entries) {
    if (COPY_EXCLUDE.has(ent.name)) continue;
    const from = path.join(src, ent.name);
    const to = path.join(dest, ent.name);
    if (ent.isDirectory()) await copyTree(from, to);
    else await fs.promises.copyFile(from, to);
  }
}

async function ensureCiClone(repo, dest) {
  const url = authGitUrl(repo);
  if (fs.existsSync(path.join(dest, '.git'))) {
    run('git fetch origin main', dest);
    run('git checkout main', dest);
    run('git reset --hard origin/main', dest);
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    run(`git clone --branch main --single-branch "${url}" "${dest}"`, path.dirname(dest));
  }
}

function preSyncClean(dir) {
  if (dryRun) return;
  try {
    exec('git restore dist/', dir, { allowFail: true });
  } catch {
    try {
      exec('git checkout -- dist/', dir, { allowFail: true });
    } catch {
      /* dist/ may not exist in index */
    }
  }
}

function commitIfNeeded(dir, message, { dry = false } = {}) {
  if (!dry) preSyncClean(dir);
  if (!dry) run('git add -A', dir);
  const status = dry ? '' : gitStatusPorcelain(dir);
  if (!status) {
    log(`${path.basename(dir)}: ${dry ? 'dry-run — no commit' : 'clean — no new commit'}`);
    return gitRevParse(dir);
  }
  if (dry) {
    log(`${path.basename(dir)}: dry-run — would commit (${status.split('\n').length} files)`);
    return gitRevParse(dir);
  }
  run(`git commit -m "${message.replace(/"/g, '\\"')}"`, dir);
  return gitRevParse(dir);
}

async function verifyRemoteSha(repo, expectedSha) {
  const token = process.env.DEPLOY_GITHUB_TOKEN || process.env.GITHUB_TOKEN || '';
  const remote = await fetchGitHubHead(repo, token);
  if (!remote.ok) {
    log(`WARN: could not verify GitHub HEAD for ${repo} (${remote.error?.message || 'api error'})`);
    return true;
  }
  if (!commitsMatch(remote.sha, expectedSha)) {
    throw new Error(
      `SHA mismatch after push: ${repo} remote=${remote.short} expected=${expectedSha.slice(0, 12)}`
    );
  }
  log(`Verified ${repo} @ ${remote.short}`);
  return true;
}

async function pushRepo(name, dir, repoSlug, message, { dry = false } = {}) {
  const before = gitRevParse(dir);
  const sha = commitIfNeeded(dir, message, { dry });
  if (!dry && !dryRun) {
    run('git push origin main', dir);
    await verifyRemoteSha(repoSlug, sha);
  }
  log(`${name} synced: ${before.slice(0, 12)} → ${sha.slice(0, 12)}${dry || dryRun ? ' (dry-run)' : ''}`);
  return sha;
}

async function syncCiRepo(name, src, repoSlug, workDir, message) {
  await ensureCiClone(repoSlug, workDir);
  log(`Copying monorepo ${path.basename(src)} → ${workDir}`);
  if (!dryRun) {
    const entries = await fs.promises.readdir(workDir, { withFileTypes: true });
    for (const ent of entries) {
      if (ent.name === '.git') continue;
      await fs.promises.rm(path.join(workDir, ent.name), { recursive: true, force: true });
    }
    await copyTree(src, workDir);
  }
  return pushRepo(name, workDir, repoSlug, message, { dry: dryRun });
}

async function main() {
  if (fs.existsSync(LOCK_PATH) && !force) {
    const lock = JSON.parse(fs.readFileSync(LOCK_PATH, 'utf8'));
    throw new Error(
      `Sync lock present (${lock.state || 'unknown'}). Resolve partial sync or run with --force. Lock: ${LOCK_PATH}`
    );
  }

  const fypSha = gitRevParse(MONOREPO_ROOT);
  const backendHash = contentHashForSubtree(MONOREPO_ROOT, 'transpak-backend');
  const frontendHash = contentHashForSubtree(MONOREPO_ROOT, 'transpak-frontend');
  const existing = loadManifest();

  if (!force && isManifestCurrent(existing, fypSha, backendHash, frontendHash)) {
    log('IDEMPOTENT SKIP: manifest already matches fyp content hashes.');
    log(JSON.stringify(existing, null, 2));
    return;
  }

  if (checkOnly) {
    console.error(
      'DRIFT: manifest stale vs monorepo. Run npm run sync:deploy-repos to push deploy repos.'
    );
    console.error(JSON.stringify({ fypSha, backendHash, frontendHash, manifest: existing }, null, 2));
    process.exit(1);
  }

  const commitMsg = `deploy: sync from fyp@${fypSha.slice(0, 12)}`;
  const rollback = {
    backend: null,
    frontend: null,
    fypSha
  };

  writeLock({ state: 'syncing', fypSha, backendHash, frontendHash });

  let backendSha = existing?.backend?.repoSha || null;
  let frontendSha = existing?.frontend?.repoSha || null;

  try {
    if (doBackend) {
      if (ciMode) {
        const workDir = path.join(MONOREPO_ROOT, '.deploy-work', 'transpak-backend');
        rollback.backend = existing?.backend?.repoSha || null;
        backendSha = await syncCiRepo('transpak-backend', BACKEND_SRC, DEPLOY_BACKEND_REPO, workDir, commitMsg);
      } else {
        if (!hasGit(BACKEND_SRC)) {
          throw new Error('Local nested .git missing in transpak-backend — use --ci in GitHub Actions.');
        }
        rollback.backend = gitRevParse(BACKEND_SRC);
        backendSha = await pushRepo('transpak-backend', BACKEND_SRC, DEPLOY_BACKEND_REPO, commitMsg, {
          dry: dryRun
        });
      }
    }

    if (doFrontend) {
      try {
        if (ciMode) {
          const workDir = path.join(MONOREPO_ROOT, '.deploy-work', 'transpak-frontend');
          rollback.frontend = existing?.frontend?.repoSha || null;
          frontendSha = await syncCiRepo(
            'transpak-frontend',
            FRONTEND_SRC,
            DEPLOY_FRONTEND_REPO,
            workDir,
            commitMsg
          );
        } else {
          if (!hasGit(FRONTEND_SRC)) {
            throw new Error('Local nested .git missing in transpak-frontend — use --ci in GitHub Actions.');
          }
          rollback.frontend = gitRevParse(FRONTEND_SRC);
          frontendSha = await pushRepo('transpak-frontend', FRONTEND_SRC, DEPLOY_FRONTEND_REPO, commitMsg, {
            dry: dryRun
          });
        }
      } catch (frontendErr) {
        writeSyncState({
          state: 'partial_failure',
          fypSha,
          backendSha,
          frontendSha: rollback.frontend,
          error: frontendErr.message,
          rollbackHint: `Backend may be ahead at ${backendSha?.slice(0, 12)} — re-run sync or revert backend to ${rollback.backend?.slice(0, 12)}`
        });
        throw frontendErr;
      }
    }

    const assetFingerprint = readAssetFingerprint(FRONTEND_SRC);
    const manifest = buildManifest({
      fypSha,
      backendSha,
      frontendSha,
      backendHash,
      frontendHash,
      assetFingerprint: {
        ...assetFingerprint,
        buildMeta: normalizeCommit(frontendSha)
      },
      chainStatus: 'synced'
    });

    if (!dryRun) {
      saveManifest(manifest);
      writeSyncState({ state: 'synced', fypSha, backendSha, frontendSha });
    }

    log('\n=== Deploy manifest ===');
    log(JSON.stringify(manifest, null, 2));
    log('\nNext: npm run wait:production && npm run verify:production');
  } finally {
    clearLock();
  }
}

main().catch((err) => {
  console.error('\nSYNC FAILED:', err.message || err);
  process.exit(1);
});
