#!/usr/bin/env node
/**
 * Push working-tree backend + frontend to their deploy remotes (Render / Cloudflare).
 * Monorepo `fyp` is source of truth; Render uses github.com/.../transpak-backend.
 *
 * Usage: node scripts/sync-deploy-repos.mjs [--backend] [--frontend] [--dry-run]
 */
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const doBackend = args.has('--backend') || args.size === 0;
const doFrontend = args.has('--frontend') || args.size === 0;

function run(cmd, cwd) {
  console.log(`\n> ${cmd}\n  (cwd: ${cwd})`);
  if (dryRun) return;
  execSync(cmd, { cwd, stdio: 'inherit', encoding: 'utf8' });
}

function hasNestedGit(dir) {
  try {
    execSync('git rev-parse --git-dir', { cwd: dir, stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function syncRepo(name, dir, message) {
  if (!hasNestedGit(dir)) {
    console.warn(`SKIP ${name}: no nested .git at ${dir}`);
    return;
  }
  run('git restore dist/ 2>nul || git checkout -- dist/ 2>nul || true', dir);
  run('git add -A', dir);
  const status = execSync('git status --porcelain', { cwd: dir, encoding: 'utf8' }).trim();
  if (!status) {
    console.log(`${name}: clean — nothing to commit`);
    run('git push origin main', dir);
    return;
  }
  run(`git commit -m "${message}"`, dir);
  run('git push origin main', dir);
  const sha = execSync('git rev-parse --short=12 HEAD', { cwd: dir, encoding: 'utf8' }).trim();
  console.log(`${name} pushed at ${sha}`);
}

console.log('TransPak deploy repo sync (nested remotes Render/Cloudflare use)');

if (doBackend) {
  syncRepo(
    'transpak-backend',
    path.join(root, 'transpak-backend'),
    'chore: sync deploy repo with monorepo stabilization pass'
  );
}

if (doFrontend) {
  syncRepo(
    'transpak-frontend',
    path.join(root, 'transpak-frontend'),
    'fix: production stabilization, Capacity Hub, auth isolation'
  );
}

console.log('\nDone. Poll: npm run wait:production (uses deploy-repo commit)');
