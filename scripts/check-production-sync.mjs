#!/usr/bin/env node
/**
 * Compare local git HEAD with live Render API deploy metadata.
 * Usage: node scripts/check-production-sync.mjs [apiOrigin]
 */
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const apiOrigin = (process.argv[2] || process.env.VITE_API_URL || 'https://transpak-backend-1.onrender.com')
  .replace(/\/api\/?.*$/i, '')
  .replace(/\/$/, '');

function localSha(repoDir) {
  try {
    return execSync('git rev-parse --short HEAD', { cwd: repoDir, encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

async function main() {
  const backendSha = localSha(path.join(root, 'transpak-backend'));
  const frontendSha = localSha(path.join(root, 'transpak-frontend'));

  console.log('Local git (short):');
  console.log('  transpak-backend:', backendSha);
  console.log('  transpak-frontend:', frontendSha);
  console.log('Checking API:', `${apiOrigin}/api/health`);

  const res = await fetch(`${apiOrigin}/api/health`, { cache: 'no-store' });
  const json = await res.json();
  const remoteBuild = json?.data?.build ?? res.headers.get('X-TransPak-Build');
  const remoteVersion = json?.data?.version ?? res.headers.get('X-TransPak-Version');

  console.log('Live API response:', JSON.stringify(json, null, 2));
  console.log('Headers:', {
    'X-TransPak-Version': res.headers.get('X-TransPak-Version'),
    'X-TransPak-Build': res.headers.get('X-TransPak-Build')
  });

  if (!remoteVersion && !remoteBuild) {
    console.error('\nSTALE: Production API has no version/build — push latest main to GitHub and redeploy Render (clear cache).');
    process.exit(1);
  }

  const buildMatches =
    !remoteBuild ||
    remoteBuild === 'local' ||
    remoteBuild === backendSha ||
    remoteBuild.startsWith(backendSha) ||
    backendSha.startsWith(remoteBuild);

  if (remoteBuild && remoteBuild !== 'local' && !buildMatches) {
    console.warn(`\nMISMATCH: API build "${remoteBuild}" != local backend "${backendSha}" — push & redeploy backend.`);
    process.exit(1);
  }

  console.log('\nOK: API exposes deploy metadata. If UI still looks old, redeploy Cloudflare Pages (clear cache).');
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
