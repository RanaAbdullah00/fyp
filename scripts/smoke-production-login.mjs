#!/usr/bin/env node
/**
 * Production login + frontend stability smoke (API + bundle static checks).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const api = "https://transpak-backend-1.onrender.com";
const frontend = "https://transpak-frontend.pages.dev";

function loadEnv() {
  const p = path.join(root, "transpak-backend", ".env");
  const env = {};
  if (!fs.existsSync(p)) return env;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 1) continue;
    env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return env;
}

const checks = [];
function record(name, pass, detail) {
  checks.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} [${name}] ${detail}`);
}

async function main() {
  const env = loadEnv();
  const email = env.E2E_ADMIN_EMAIL || env.E2E_ADMIN_ONLY_EMAIL;
  const password = env.PHASE1_RBAC_PASSWORD || env.E2E_ADMIN_PASSWORD;

  // Bad password must not be 503
  const badRes = await fetch(`${api}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "nobody@example.com", password: "wrong", roleHint: "shipper" })
  });
  const badBody = await badRes.json().catch(() => ({}));
  record(
    "login-bad-not-503",
    badRes.status !== 503,
    `HTTP ${badRes.status} code=${badBody?.error?.code || "n/a"}`
  );

  if (email && password) {
    const okRes = await fetch(`${api}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, roleHint: "admin" })
    });
    const okBody = await okRes.json().catch(() => ({}));
    record(
      "login-valid-200",
      okRes.status === 200 && !!okBody?.data?.token,
      `HTTP ${okRes.status} token=${!!okBody?.data?.token}`
    );

    if (okBody?.data?.token) {
      const histRes = await fetch(`${api}/api/shipments/history`, {
        headers: { Authorization: `Bearer ${okBody.data.token}`, Accept: "application/json" }
      });
      record("shipments-history-authed", histRes.status === 200, `HTTP ${histRes.status}`);
    }
  } else {
    record("login-valid-200", false, "SKIP — no E2E creds in transpak-backend/.env");
  }

  // Frontend bundle stability markers
  const html = await (await fetch(frontend, { cache: "no-store" })).text();
  const bundleMatch = html.match(/assets\/index-([A-Za-z0-9_-]+)\.js/);
  if (!bundleMatch) {
    record("frontend-bundle", false, "main bundle not found in index.html");
  } else {
    const bundleUrl = `${frontend}/assets/index-${bundleMatch[1]}.js`;
    const js = await (await fetch(bundleUrl, { cache: "no-store" })).text();
    const mismatchOk =
      js.includes("Try again shortly") ||
      js.includes("Backend may be updating");
    const deployBannerOk = !js.includes("System updated") || mismatchOk;
    const hasControlledCopy =
      js.includes("serverUnavailable") || js.includes("Server temporarily unavailable");
    record("frontend-deploy-banner", deployBannerOk, "deploy mismatch uses retry copy, not forced refresh");
    record("frontend-controlled-errors", hasControlledCopy, "controlled unavailable messaging in bundle");
  }

  const failed = checks.filter((c) => !c.pass);
  console.log(`\n--- Smoke: ${checks.length - failed.length}/${checks.length} passed ---`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
