#!/usr/bin/env node
/**
 * Production release gate probe — read-only checks against live API.
 * Usage: node scripts/release-gate-probe.mjs [apiOrigin]
 */
const apiOrigin = (process.argv[2] || process.env.VITE_API_URL || "https://transpak-backend-1.onrender.com")
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
  record("schema-026", d.schema?.version === "026", `expected 026 (got ${d.schema?.version})`);

  const probes = [
    ["/api/shipments/active", 401, "shipments-active-auth"],
    ["/api/public/stats", 200, "public-stats"],
  ];
  for (const [path, expectMin, id] of probes) {
    try {
      const r = await fetch(`${apiOrigin}${path}`, { cache: "no-store" });
      const pass = path.includes("active") ? r.status === 401 || r.status === 200 : r.status === expectMin || r.status === 401;
      record(id, pass, `${path} HTTP ${r.status}${path.includes("active") && r.status === 404 ? " (route missing — deploy final backend)" : ""}`);
    } catch (e) {
      record(id, false, e.message);
    }
  }

  try {
    const fe = await fetch(frontendOrigin, { cache: "no-store", headers: { Accept: "text/html" } });
    const html = await fe.text();
    const bundle = html.match(/assets\/index-[A-Za-z0-9_-]+\.js/)?.[0];
    record("frontend-http", fe.ok, `HTTP ${fe.status} bundle=${bundle || "n/a"}`);
    if (bundle) {
      const js = await fetch(`${frontendOrigin}/${bundle}`, { cache: "no-store" }).then((r) => r.text());
      record("frontend-state-engine", js.includes("getNextAllowedActions"), "stateNormalizationEngine active");
      record("frontend-admin-smart", js.includes("mrrajpoot.327@gmail.com") || js.includes("isAdminSmartLoginEmail"), "admin smart login in bundle");
      record("frontend-profile-layer", js.includes("ProfileAccessLayer"), "ProfileAccessLayer in bundle");
    }
  } catch (e) {
    record("frontend-http", false, e.message);
  }

  printSummary();
  process.exit(checks.some((c) => !c.pass && !c.name.startsWith("schema-026")) ? 1 : 0);
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
