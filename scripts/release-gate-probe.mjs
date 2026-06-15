#!/usr/bin/env node
/**
 * Production release gate probe — read-only checks against live API.
 * Usage: node scripts/release-gate-probe.mjs [apiOrigin]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadEnvFile(relPath) {
  const p = path.join(root, relPath);
  if (!fs.existsSync(p)) return {};
  const out = {};
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 1) continue;
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return out;
}

const env = { ...loadEnvFile("transpak-backend/.env"), ...process.env };

const apiOrigin = (process.argv[2] || env.VITE_API_URL || "https://transpak-backend-1.onrender.com")
  .replace(/\/api\/?.*$/i, "")
  .replace(/\/$/, "");

const frontendOrigin = (
  process.env.VITE_FRONTEND_URL ||
  process.env.CLOUDFLARE_PAGES_URL ||
  "https://transpak-frontend.pages.dev"
).replace(/\/$/, "");

const checks = [];

function record(name, pass, detail) {
  checks.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} [${name}] ${detail}`);
}

async function loginShipper() {
  const email = env.E2E_SHIPPER_ONLY_EMAIL || env.E2E_SHIPPER_EMAIL;
  const password = env.PHASE1_RBAC_PASSWORD || env.E2E_SHIPPER_PASSWORD;
  if (!email || !password) return null;
  const res = await fetch(`${apiOrigin}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ email, password, roleHint: "shipper" })
  });
  const body = await res.json();
  if (!res.ok || !body?.data?.token) return null;
  return body.data.token;
}

async function main() {
  console.log(`\n=== TransPAK Release Gate Probe ===\nAPI: ${apiOrigin}\nFrontend: ${frontendOrigin}\n`);

  let health;
  try {
    const res = await fetch(`${apiOrigin}/api/health`, { cache: "no-store" });
    health = await res.json();
    record("health-http", res.ok, `HTTP ${res.status}`);
  } catch (e) {
    record("health-http", false, e.message);
    printSummary();
    process.exit(1);
  }

  const d = health?.data || {};
  record("health-phase", d.healthPhase === "ready", `phase=${d.healthPhase}`);
  record("db-ready", d.db === "ready" && d.dbPing === "ok", `db=${d.db} ping=${d.dbPing}`);
  record("schema-ok", d.schema?.ok === true, `schemaVersion=${d.schema?.version} missing=${(d.schema?.missing || []).join(",") || "none"}`);
  record("migration-safe", d.deploy?.migrationSafe === true, `migrationSafe=${d.deploy?.migrationSafe}`);
  record("socket-engine", d.socketEngine === "ready", `socketEngine=${d.socketEngine} sockets=${d.sockets}`);
  record("schema-version", ["028", "029"].includes(String(d.schema?.version)), `expected 028+ (got ${d.schema?.version})`);
  if (d.distributed) {
    record(
      "distributed-health",
      !d.distributed.requiresRedis || d.distributed.ok !== false,
      `strict=${d.distributed.strict} ok=${d.distributed.ok} mode=${d.distributed.mode}`
    );
  }

  const probes = [
    ["/api/shipments/active", 401, "shipments-active-auth"],
    ["/api/shipments/history", 401, "shipments-history-route"],
    ["/api/public/stats", 200, "public-stats"],
  ];
  for (const [path, expectMin, id] of probes) {
    try {
      const r = await fetch(`${apiOrigin}${path}`, { cache: "no-store" });
      const isHistory = path.includes("/history");
      const pass = isHistory
        ? r.status === 401 || r.status === 200
        : path.includes("active")
          ? r.status === 401 || r.status === 200
          : r.status === expectMin || r.status === 401;
      const detail =
        isHistory && r.status === 404
          ? `${path} HTTP 404 (route missing — deploy stabilization backend)`
          : `${path} HTTP ${r.status}${path.includes("active") && r.status === 404 ? " (route missing — deploy final backend)" : ""}`;
      record(id, pass, detail);
    } catch (e) {
      record(id, false, e.message);
    }
  }

  try {
    const token = await loginShipper();
    if (!token) {
      record("ops-snapshot-contract", false, "skipped — set PHASE1_RBAC_PASSWORD + E2E_SHIPPER_ONLY_EMAIL in transpak-backend/.env");
    } else {
      const snapRes = await fetch(
        `${apiOrigin}/api/operations/snapshot?workspace=shipper&viewAs=shipper`,
        { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, cache: "no-store" }
      );
      const snapBody = await snapRes.json();
      const shipper = snapBody?.data?.shipper;
      const ok =
        snapRes.ok &&
        shipper &&
        typeof shipper.requestSentCount === "number" &&
        typeof shipper.activeShipmentCount === "number";
      record(
        "ops-snapshot-contract",
        ok,
        snapRes.ok
          ? `requestSent=${shipper?.requestSentCount} active=${shipper?.activeShipmentCount} HTTP ${snapRes.status}`
          : `HTTP ${snapRes.status} ${snapBody?.message || "error"}`
      );
    }
  } catch (e) {
    record("ops-snapshot-contract", false, e.message);
  }

  try {
    const fe = await fetch(frontendOrigin, { cache: "no-store", headers: { Accept: "text/html" } });
    const html = await fe.text();
    const bundle = html.match(/assets\/index-[A-Za-z0-9_-]+\.js/)?.[0];
    record("frontend-http", fe.ok, `HTTP ${fe.status} bundle=${bundle || "n/a"}`);
    if (bundle) {
      const js = await fetch(`${frontendOrigin}/${bundle}`, { cache: "no-store" }).then((r) => r.text());
      record("frontend-state-engine", js.includes("pages.tracking.advanceClosed") || js.includes("advanceIntransit"), "shipment advance i18n keys in bundle");
      record("frontend-admin-smart", js.includes("mrrajpoot.327@gmail.com") || js.includes("isAdminSmartLoginEmail"), "admin smart login in bundle");
      record("frontend-profile-layer", js.includes("/profile/u/") && js.includes("tp-profile-link"), "profile link routing in bundle");
      record("frontend-multi-shipment", js.includes("/shipments/active"), "bundle references /shipments/active");
      record(
        "frontend-notif-dual-role",
        js.includes("includeAllRoles") &&
          (js.includes("read-all', undefined") || js.includes('read-all",void 0') || js.includes("read-all\",null")),
        "dual-role notification PATCH query params in bundle"
      );
    }
  } catch (e) {
    record("frontend-http", false, e.message);
  }

  printSummary();
  process.exit(checks.some((c) => !c.pass) ? 1 : 0);
}

function printSummary() {
  const failed = checks.filter((c) => !c.pass);
  console.log(`\n--- Summary: ${checks.length - failed.length}/${checks.length} passed ---`);
  if (failed.length) {
    console.log("Failed:", failed.map((f) => f.name).join(", "));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
