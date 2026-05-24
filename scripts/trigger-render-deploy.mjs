#!/usr/bin/env node
/**
 * POST to Render deploy hook (create in Dashboard → Service → Settings → Deploy Hook).
 * Usage: RENDER_DEPLOY_HOOK_URL=https://api.render.com/... node scripts/trigger-render-deploy.mjs
 */
const url = String(process.env.RENDER_DEPLOY_HOOK_URL || process.argv[2] || "").trim();
if (!url) {
  console.error("Set RENDER_DEPLOY_HOOK_URL or pass URL as argv[2]");
  process.exit(1);
}
const res = await fetch(url, { method: "POST" });
console.log("Render deploy hook:", res.status, res.statusText);
if (!res.ok) process.exit(1);
