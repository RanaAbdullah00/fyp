#!/usr/bin/env node
/**
 * Triple-repo deploy chain verification — fyp manifest ↔ deploy repos ↔ live production.
 *
 * Usage:
 *   node scripts/verify-deploy-chain.mjs [--strict] [--json]
 *
 * Exit 0 = READY (or PASS with --no-strict warnings)
 * Exit 1 = DRIFT STATE (blocks production READY)
 */
import { execSync } from 'node:child_process';
import path from 'node:path';
import {
  MONOREPO_ROOT,
  DEFAULT_API_ORIGIN,
  DEFAULT_FRONTEND_URLS,
  commitsMatch,
  fetchFrontendHtml,
  fetchGitHubHead,
  fetchRenderHealth,
  gitRevParse,
  hasGit,
  loadManifest,
  normalizeCommit,
  saveManifest
} from './lib/deploy-chain.mjs';

const strict =
  process.argv.includes('--strict') ||
  String(process.env.DEPLOY_STRICT || '').toLowerCase() === '1' ||
  String(process.env.DEPLOY_STRICT || '').toLowerCase() === 'true';
const jsonOnly = process.argv.includes('--json');

const apiOrigin = (
  process.argv.find((a) => a.startsWith('--api='))?.slice(6) ||
  process.env.VITE_API_URL ||
  DEFAULT_API_ORIGIN
).replace(/\/api\/?.*$/i, '').replace(/\/$/, '');

function section(title) {
  if (!jsonOnly) console.log(`\n=== ${title} ===`);
}

function localHead(subdir) {
  const dir = path.join(MONOREPO_ROOT, subdir);
  if (!hasGit(dir)) return { sha: null, source: 'missing' };
  return { sha: gitRevParse(dir), source: 'nested-git' };
}

function fypHead() {
  try {
    return execSync('git rev-parse HEAD', { cwd: MONOREPO_ROOT, encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

async function main() {
  section('Deploy chain — manifest');
  const manifest = loadManifest();
  const fypSha = fypHead();
  const backendLocal = localHead('transpak-backend');
  const frontendLocal = localHead('transpak-frontend');

  const failures = [];
  const warnings = [];
  const checks = [];

  function record(id, ok, detail, severity = 'fail') {
    checks.push({ id, ok, detail });
    if (!ok) {
      if (severity === 'fail') failures.push({ type: id, detail });
      else warnings.push({ type: id, detail });
    }
  }

  if (!manifest) {
    record('MANIFEST_MISSING', false, `No ${path.join('deploy', 'manifest.json')} — run npm run sync:deploy-repos`);
  } else {
    record(
      'MANIFEST_FYP',
      manifest.fyp?.sha === fypSha,
      `manifest.fyp=${normalizeCommit(manifest.fyp?.sha)} current fyp=${normalizeCommit(fypSha)}`,
      strict ? 'fail' : 'warn'
    );

    if (backendLocal.sha) {
      record(
        'LOCAL_BACKEND_REPO',
        commitsMatch(backendLocal.sha, manifest.backend?.repoSha),
        `nested backend=${normalizeCommit(backendLocal.sha)} manifest=${normalizeCommit(manifest.backend?.repoSha)}`
      );
    }

    if (frontendLocal.sha) {
      record(
        'LOCAL_FRONTEND_REPO',
        commitsMatch(frontendLocal.sha, manifest.frontend?.repoSha),
        `nested frontend=${normalizeCommit(frontendLocal.sha)} manifest=${normalizeCommit(manifest.frontend?.repoSha)}`
      );
    }
  }

  section('Live backend (Render)');
  let render;
  try {
    render = await fetchRenderHealth(apiOrigin);
    record(
      'RENDER_COMMIT',
      manifest ? commitsMatch(render.commitFull, manifest.backend?.repoSha) : false,
      `live=${render.normalized || 'none'} manifest=${normalizeCommit(manifest?.backend?.repoSha)}`
    );
    record(
      'RENDER_HEALTH',
      render.db === 'ready' && render.schemaOk === true,
      `db=${render.db} schemaOk=${render.schemaOk}`
    );
    record(
      'RENDER_SOCKET',
      render.socketEngine === 'ready' || render.raw?.data?.sockets != null,
      `socketEngine=${render.socketEngine}`
    );
  } catch (err) {
    record('RENDER_UNREACHABLE', false, err.message || String(err));
  }

  section('Deploy repo remotes (GitHub)');
  const token = process.env.DEPLOY_GITHUB_TOKEN || process.env.GITHUB_TOKEN || '';
  if (manifest) {
    const ghBackend = await fetchGitHubHead(manifest.backend?.repo, token);
    const ghFrontend = await fetchGitHubHead(manifest.frontend?.repo, token);
    if (ghBackend.ok) {
      record(
        'GITHUB_BACKEND',
        commitsMatch(ghBackend.sha, manifest.backend?.repoSha),
        `github main=${ghBackend.short} manifest=${normalizeCommit(manifest.backend?.repoSha)}`
      );
    } else {
      record('GITHUB_BACKEND', false, 'Could not fetch backend repo HEAD', strict ? 'fail' : 'warn');
    }
    if (ghFrontend.ok) {
      record(
        'GITHUB_FRONTEND',
        commitsMatch(ghFrontend.sha, manifest.frontend?.repoSha),
        `github main=${ghFrontend.short} manifest=${normalizeCommit(manifest.frontend?.repoSha)}`
      );
    } else {
      record('GITHUB_FRONTEND', false, 'Could not fetch frontend repo HEAD', strict ? 'fail' : 'warn');
    }
  }

  section('Live frontend (Cloudflare Pages)');
  const frontendUrls = manifest?.live?.frontendUrls || DEFAULT_FRONTEND_URLS;
  const liveFrontends = [];
  for (const url of frontendUrls) {
    try {
      const fe = await fetchFrontendHtml(url);
      liveFrontends.push(fe);
      const buildMetaOk =
        manifest?.frontend?.buildMeta &&
        fe.buildMeta &&
        commitsMatch(fe.buildMeta, manifest.frontend.buildMeta);
      const bundleOk = fe.mainJs != null;
      const fingerprintOk = manifest?.frontend?.assetFingerprint
        ? fe.mainJs === manifest.frontend.assetFingerprint
        : true;

      record(
        `FRONTEND_${new URL(url).hostname.split('.')[0]}`,
        buildMetaOk || (fingerprintOk && bundleOk && !manifest?.frontend?.buildMeta),
        `${url} bundle=index-${fe.mainJs || 'MISSING'}.js meta=${fe.buildMeta || 'none'} expected=${manifest?.frontend?.buildMeta || manifest?.frontend?.assetFingerprint || 'any'} cf-cache=${fe.cfCache}`
      );
    } catch (err) {
      record(`FRONTEND_${url}`, false, err.message || String(err), 'warn');
    }
  }

  const allBundles = liveFrontends.filter((f) => f.mainJs).map((f) => f.mainJs);
  const uniqueBundles = [...new Set(allBundles)];
  if (uniqueBundles.length > 1) {
    record(
      'FRONTEND_BUNDLE_SPLIT',
      false,
      `Multiple live JS bundles detected: ${uniqueBundles.join(', ')} — purge Cloudflare cache / redeploy`
    );
  }

  const chainSynced =
    failures.length === 0 &&
    manifest?.chainStatus === 'synced' &&
    (render ? commitsMatch(render.commitFull, manifest?.backend?.repoSha) : false);

  const report = {
    status: failures.length ? 'DRIFT_STATE' : warnings.length ? 'WARNING' : 'READY',
    chainSynced,
    strict,
    fyp: { sha: fypSha, short: normalizeCommit(fypSha) },
    manifest: manifest
      ? {
          fyp: manifest.fyp?.short,
          backend: manifest.backend?.short,
          frontend: manifest.frontend?.short,
          assetFingerprint: manifest.frontend?.assetFingerprint,
          chainStatus: manifest.chainStatus
        }
      : null,
    live: {
      render: render
        ? { commit: render.normalized, db: render.db, schemaOk: render.schemaOk, socketEngine: render.socketEngine }
        : null,
      frontends: liveFrontends.map((f) => ({
        url: f.url,
        mainJs: f.mainJs,
        buildMeta: f.buildMeta,
        cfCache: f.cfCache
      }))
    },
    checks,
    failures,
    warnings,
    alert: failures.length
      ? `DRIFT STATE: ${failures.map((f) => f.type).join(', ')}`
      : null
  };

  if (manifest && !failures.length) {
    manifest.live = {
      ...manifest.live,
      renderCommit: render?.commitFull || null,
      lastVerifiedAt: new Date().toISOString(),
      frontendBundles: liveFrontends.map((f) => ({ url: f.url, mainJs: f.mainJs }))
    };
    try {
      saveManifest(manifest);
    } catch {
      /* read-only env */
    }
  }

  section('Deploy chain report');
  console.log(JSON.stringify(report, null, 2));

  if (failures.length) {
    console.error('\n*** DRIFT STATE — production NOT READY ***');
    for (const f of failures) console.error(`FAIL [${f.type}] ${f.detail}`);
    process.exit(1);
  }

  if (warnings.length && strict) {
    console.warn('\nWARN (strict mode treats warnings as notes only — chain PASS)');
    for (const w of warnings) console.warn(`WARN [${w.type}] ${w.detail}`);
  }

  console.log('\nOK: Deploy chain FULL PASS — fyp → backend → frontend mapped and live.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
