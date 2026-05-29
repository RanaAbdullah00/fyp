#!/usr/bin/env node
/**
 * Compare local git HEAD with live Render API + Cloudflare Pages reachability.
 * Uses normalized 12-char commit comparison (full vs short SHA safe).
 *
 * Usage: node scripts/check-production-sync.mjs [apiOrigin] [frontendOrigin]
 */
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(root, "transpak-backend/package.json"));
const { normalizeCommit, commitsMatch } = require(path.join(
  root,
  "transpak-backend/utils/normalizeCommit.js"
));

const apiOrigin = (process.argv[2] || process.env.VITE_API_URL || "https://transpak-backend-1.onrender.com")
  .replace(/\/api\/?.*$/i, "")
  .replace(/\/$/, "");

const frontendOrigin = (
  process.argv[3] ||
  process.env.VITE_FRONTEND_URL ||
  process.env.CLOUDFLARE_PAGES_URL ||
  "https://cb3857ee.transpak-frontend.pages.dev"
).replace(/\/$/, "");

function localSha(repoDir, full = false) {
  try {
    return execSync(full ? "git rev-parse HEAD" : "git rev-parse --short HEAD", {
      cwd: repoDir,
      encoding: "utf8"
    }).trim();
  } catch {
    return "unknown";
  }
}

async function main() {
  const backendDir = path.join(root, "transpak-backend");
  const backendFull = localSha(backendDir, true);
  const backendShort = localSha(backendDir, false);
  const frontendSha = localSha(path.join(root, "transpak-frontend"));

  console.log("Local git:");
  console.log("  transpak-backend (full):", backendFull);
  console.log("  transpak-backend (norm):", normalizeCommit(backendFull));
  console.log("  transpak-frontend:", frontendSha);
  console.log("Checking API:", `${apiOrigin}/api/health`);

  const res = await fetch(`${apiOrigin}/api/health`, { cache: "no-store" });
  const json = await res.json();
  const deploy = json?.data?.deploy || {};
  const remoteFull =
    deploy.commitFull || json?.data?.commitFull || json?.data?.build || res.headers.get("X-TransPak-Build");
  const remoteNorm = deploy.normalizedCommit || deploy.commitShort || normalizeCommit(remoteFull);
  const remoteVersion = json?.data?.version ?? res.headers.get("X-TransPak-Version");

  console.log("Live API response:", JSON.stringify(json, null, 2));

  if (!remoteVersion && !remoteFull) {
    console.error("\nSTALE: Production API has no version/build — push latest main and redeploy Render (clear cache).");
    process.exit(1);
  }

  const buildMatches = commitsMatch(backendFull, remoteFull);

  if (remoteFull && remoteFull !== "local" && remoteFull !== "unknown" && !buildMatches) {
    console.warn(
      `\nWARN (CODE_DRIFT): API ${remoteNorm} != local ${normalizeCommit(backendFull)} — push & redeploy backend (clear cache).`
    );
    console.warn("  Run: cd transpak-backend && npm run predeploy:check");
    process.exit(1);
  }

  if (json?.data?.deploy?.bootHealthWait !== true && !json?.data?.schema?.booting && json?.data?.healthPhase == null) {
    console.warn(
      "\nNOTE: Live API may be missing latest health fields (bootHealthWait) — redeploy backend from latest main."
    );
  }

  console.log("\nOK: API commit matches local (normalized).");

  console.log("\nChecking frontend:", frontendOrigin);
  try {
    const feRes = await fetch(frontendOrigin, {
      cache: "no-store",
      headers: { Accept: "text/html" }
    });
    const html = await feRes.text();
    const hasRoot = html.includes('id="root"') || html.includes("id='root'");
    const assetHint = html.match(/assets\/index-[A-Za-z0-9_-]+\.js/);
    console.log("Frontend HTTP:", feRes.status, {
      "cf-cache-status": feRes.headers.get("cf-cache-status"),
      hasRoot,
      mainBundle: assetHint ? assetHint[0] : "n/a"
    });
  } catch (e) {
    console.warn("Frontend check failed:", e.message);
  }

  process.exit(0);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
