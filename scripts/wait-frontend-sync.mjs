#!/usr/bin/env node
/**
 * Poll Cloudflare Pages until all production URLs serve the manifest asset fingerprint.
 *
 * Usage: node scripts/wait-frontend-sync.mjs
 */
import {
  DEFAULT_FRONTEND_URLS,
  fetchFrontendHtml,
  loadManifest,
  normalizeCommit
} from './lib/deploy-chain.mjs';

const manifest = loadManifest();
const expected = manifest?.frontend?.buildMeta || manifest?.frontend?.assetFingerprint;
const expectedBuild = manifest?.frontend?.short || normalizeCommit(manifest?.frontend?.repoSha);
const urls = manifest?.live?.frontendUrls || DEFAULT_FRONTEND_URLS;
const maxAttempts = Number(process.env.WAIT_FRONTEND_ATTEMPTS || 30);
const intervalMs = Number(process.env.WAIT_FRONTEND_INTERVAL_MS || 20000);

if (!expected) {
  console.error('No manifest.frontend.assetFingerprint — run sync after frontend build.');
  process.exit(1);
}

console.log(`Waiting for frontend deploy ${expectedBuild} (meta=${manifest?.frontend?.buildMeta || expected}) on ${urls.length} URL(s) …`);

for (let i = 1; i <= maxAttempts; i++) {
  const results = await Promise.all(urls.map((url) => fetchFrontendHtml(url)));
  const bundles = results.map((r) => r.mainJs);
  const metas = results.map((r) => r.buildMeta);
  const unique = [...new Set(bundles.filter(Boolean))];
  const metaMatch = manifest?.frontend?.buildMeta
    ? results.every((r) => r.buildMeta && normalizeCommit(r.buildMeta) === normalizeCommit(manifest.frontend.buildMeta))
    : results.every((r) => r.mainJs === expected);
  console.log(
    `[${i}/${maxAttempts}] bundles=${unique.join(',') || 'none'} meta=${metas.join('|') || '-'}`
  );
  if (metaMatch && unique.length === 1) {
    console.log(`PASS: frontend aligned (deploy ${expectedBuild}, bundle index-${unique[0]}.js).`);
    process.exit(0);
  }
  if (i < maxAttempts) await new Promise((r) => setTimeout(r, intervalMs));
}

console.error(`TIMEOUT: expected index-${expected}.js — Cloudflare may still be building ${expectedBuild}.`);
process.exit(1);
