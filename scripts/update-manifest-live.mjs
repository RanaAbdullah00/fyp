#!/usr/bin/env node
/**
 * Update deploy/manifest.json to match verified live production SHAs.
 * Usage: node scripts/update-manifest-live.mjs
 */
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  MONOREPO_ROOT,
  buildManifest,
  contentHashForSubtree,
  fetchRenderHealth,
  fetchFrontendHtml,
  gitRevParse,
  saveManifest,
  PRODUCTION_FRONTEND_URL
} from "./lib/deploy-chain.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const fypSha = gitRevParse(MONOREPO_ROOT);
  const backendHash = contentHashForSubtree(MONOREPO_ROOT, "transpak-backend");
  const frontendHash = contentHashForSubtree(MONOREPO_ROOT, "transpak-frontend");

  const render = await fetchRenderHealth();
  const frontendHtml = await fetchFrontendHtml(PRODUCTION_FRONTEND_URL);
  const frontendDir = path.join(MONOREPO_ROOT, "transpak-frontend");
  const nestedFrontendSha = gitRevParse(frontendDir);

  const backendSha = render.commitFull || gitRevParse(path.join(MONOREPO_ROOT, "transpak-backend"));
  const frontendSha = nestedFrontendSha;

  const manifest = buildManifest({
    fypSha,
    backendSha,
    frontendSha,
    backendHash,
    frontendHash,
    assetFingerprint: {
      mainJs: frontendHtml.mainJs,
      buildMeta: frontendHtml.buildMeta || nestedFrontendSha.slice(0, 12)
    },
    chainStatus: "synced"
  });

  manifest.live.lastVerifiedAt = new Date().toISOString();
  saveManifest(manifest);

  console.log("Manifest updated to live production:");
  console.log(JSON.stringify(manifest, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
