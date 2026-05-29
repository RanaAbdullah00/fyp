#!/usr/bin/env node
/**
 * Verify production deployment alignment (code version + schema 023 + DB target).
 * Outputs Phase 6 final report JSON.
 *
 * Usage: node scripts/verify-production-alignment.mjs [apiOrigin]
 */
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.join(__dirname, "..");
const require = createRequire(path.join(backendRoot, "package.json"));
require("dotenv").config({ path: path.join(backendRoot, ".env") });

const API_ORIGIN = (
  process.argv[2] ||
  process.env.QA_BASE_URL ||
  process.env.VITE_API_URL ||
  "https://transpak-backend-1.onrender.com"
)
  .replace(/\/api\/?.*$/i, "")
  .replace(/\/$/, "");

const EXPECTED_SCHEMA = "023";
const REQUIRED_MIGRATIONS = [
  "020_truck_fleet_status.sql",
  "021_matching_engine_indexes.sql",
  "022_fleet_lifecycle.sql",
  "023_notifications_realtime.sql",
  "024_truck_status_constraint_reconcile.sql"
];

function localCommitShort() {
  try {
    return execSync("git rev-parse --short HEAD", {
      cwd: path.join(__dirname, "..", ".."),
      encoding: "utf8"
    }).trim();
  } catch {
    return "unknown";
  }
}

function printSection(title) {
  console.log(`\n=== ${title} ===`);
}

function classifyTruckConstraint(def) {
  const d = String(def || "").toLowerCase();
  const hasCanonical =
    d.includes("pending") && d.includes("approved") && d.includes("suspended");
  const hasLegacy = d.includes("active") || d.includes("pending_verification");
  if (hasCanonical && !hasLegacy) return "OK";
  if (hasLegacy) return "LEGACY";
  return "UNKNOWN";
}

async function auditDatabase(pool) {
  const issues = [];
  const migCols = await pool.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'schema_migrations'`
  );
  const migColNames = migCols.rows.map((r) => r.column_name);
  const orderBy = migColNames.includes("id")
    ? "id"
    : migColNames.includes("executed_at")
      ? "executed_at"
      : migColNames.includes("applied_at")
        ? "applied_at"
        : "name";
  const migrations = await pool.query(`SELECT name FROM schema_migrations ORDER BY ${orderBy}`);
  const names = new Set(migrations.rows.map((r) => r.name));
  const missingMigrations = REQUIRED_MIGRATIONS.filter((m) => !names.has(m));

  let lockStuck = false;
  try {
    const lock = await pool.query(`SELECT locked, updated_at FROM migration_lock WHERE id = 1`);
    const row = lock.rows[0];
    if (row?.locked) {
      const ageMs = Date.now() - new Date(row.updated_at).getTime();
      const staleMs = Number(process.env.MIGRATION_LOCK_STALE_MS || 20 * 60 * 1000);
      if (ageMs < staleMs) lockStuck = true;
    }
  } catch {
    /* table created on next migrate */
  }

  const truckCheck = await pool.query(
    `SELECT pg_get_constraintdef(oid) AS def
     FROM pg_constraint
     WHERE conrelid = 'public.trucks'::regclass AND conname = 'trucks_status_check'`
  );
  const truckConstraint = classifyTruckConstraint(truckCheck.rows[0]?.def);

  if (missingMigrations.length) {
    issues.push({ type: "DB_SCHEMA_DRIFT", detail: `Missing migrations: ${missingMigrations.join(", ")}` });
  }
  if (lockStuck) {
    issues.push({ type: "MIGRATION_LOCK_STUCK", detail: "migration_lock.locked=true — run audit:production-db --repair" });
  }
  if (truckConstraint === "LEGACY") {
    issues.push({ type: "DB_SCHEMA_DRIFT", detail: "trucks_status_check uses legacy enum values" });
  }

  const legacyRows = await pool.query(
    `SELECT COUNT(*)::int AS c FROM trucks
     WHERE lower(trim(status)) IN ('active','pending_verification')`
  );
  if (legacyRows.rows[0]?.c > 0) {
    issues.push({
      type: "LEGACY_TRUCK_ROWS",
      detail: `${legacyRows.rows[0].c} rows still use active/pending_verification`
    });
  }

  const migrationStatus =
    missingMigrations.length > 0 ? "PARTIAL" : issues.some((i) => i.type === "DB_SCHEMA_DRIFT") ? "PARTIAL" : "OK";

  return {
    migrationCount: migrations.rows.length,
    missingMigrations,
    migrationStatus,
    truckConstraint,
    lockStuck,
    issues
  };
}

async function main() {
  printSection("Phase 1 — Deployment verification");
  const localSha = localCommitShort();
  console.log("Local git HEAD (short):", localSha);

  printSection("Production /api/health");
  const url = `${API_ORIGIN}/api/health`;
  console.log("GET", url);
  const res = await fetch(url, { cache: "no-store" });
  const body = await res.json();
  console.log(JSON.stringify(body, null, 2));

  const data = body?.data || {};
  const remoteBuild = data.build || data.commit || res.headers.get("X-TransPak-Build");
  const commitMatch =
    Boolean(localSha && remoteBuild && localSha !== "unknown") &&
    (String(remoteBuild).startsWith(localSha) || String(remoteBuild) === localSha);

  if (!commitMatch) {
    console.log("\n*** CODE DRIFT DETECTED ***");
    console.log(`Render: ${remoteBuild || "unknown"}  |  Local: ${localSha}`);
  }

  printSection("Phase 2 — Database consistency (local DATABASE_URL)");
  let dbAudit = { migrationStatus: "SKIPPED", issues: [] };
  let localDb = null;
  try {
    const { getSanitizedDatabaseInfo, formatSanitizedDatabaseLog } = require(path.join(
      backendRoot,
      "utils/dbSanitizedInfo.js"
    ));
    localDb = getSanitizedDatabaseInfo();
    console.log("Target:", formatSanitizedDatabaseLog(localDb));
    const { getPool, endPool } = require(path.join(backendRoot, "db/pool.js"));
    const pool = getPool();
    dbAudit = await auditDatabase(pool);
    console.log("Migrations 020–024:", dbAudit.migrationStatus);
    if (dbAudit.missingMigrations?.length) {
      console.log("Missing:", dbAudit.missingMigrations.join(", "));
    }
    console.log("trucks_status_check:", dbAudit.truckConstraint);
    console.log("migration_lock stuck:", dbAudit.lockStuck);
    await endPool();
  } catch (e) {
    console.log("DB audit skipped:", e.message);
    dbAudit.issues.push({ type: "DB_CONNECT_FAILED", detail: e.message });
  }

  const hasSchema = data.schema != null;
  const schemaOk = data.schema?.ok === true;
  const schemaVer = data.schemaVersion || data.schema?.version || data.deploy?.schemaGuardVersion;
  const dbStatus = data.db === "ready" ? "ready" : "unavailable";
  const dbTargetMatch =
    Boolean(localDb?.host && data.deploy?.databaseTarget?.host) &&
    localDb.host === data.deploy.databaseTarget.host;

  const issues = [...dbAudit.issues];

  if (!commitMatch) {
    issues.unshift({
      type: "CODE_DRIFT",
      detail: `Render "${remoteBuild}" != local "${localSha}" — push latest commit and redeploy Render backend`
    });
  }
  if (!hasSchema || data.dbPing === "skipped") {
    issues.push({
      type: "STALE_HEALTH_ENDPOINT",
      detail: "Production lacks live health/schema — redeploy backend from latest commit"
    });
  }
  if (hasDeployMismatch(localDb, data)) {
    issues.push({
      type: "DB_TARGET_MISMATCH",
      detail: `Render DB host "${data.deploy.databaseTarget.host}" != local "${localDb.host}"`
    });
  }
  if (schemaOk === false) {
    issues.push({
      type: "DB_SCHEMA_MISSING",
      detail: `Missing: ${(data.schema?.missing || []).join(", ")}`
    });
  }

  const deploymentStatus = commitMatch && !issues.some((i) => i.type === "CODE_DRIFT") ? "SYNCED" : "DRIFTED";
  const migrationStatus =
    dbAudit.migrationStatus === "OK" && schemaOk !== false
      ? "OK"
      : dbAudit.missingMigrations?.length || schemaOk === false
        ? "PARTIAL"
        : "MISSING";

  const report = {
    deploymentStatus,
    commitMatch,
    localCommit: localSha,
    remoteCommit: remoteBuild || null,
    migrationStatus,
    dbStatus: schemaOk && data.db === "ready" ? "ready" : "unavailable",
    schemaVersion: schemaVer || EXPECTED_SCHEMA,
    dbTargetMatch,
    productionHealth: {
      db: data.db,
      dbPing: data.dbPing,
      schemaOk,
      migrationSafe: data.deploy?.migrationSafe
    },
    issues: issues.map((i) => ({ type: i.type, detail: i.detail })),
    primaryCause: !commitMatch
      ? "CODE_DRIFT"
      : issues.some((i) => i.type.includes("SCHEMA") || i.type === "DB_SCHEMA_DRIFT")
        ? "DB_SCHEMA_DRIFT"
        : issues.length
          ? "OPERATIONAL"
          : null,
    recommendedActions: []
  };

  if (!commitMatch) {
    report.recommendedActions.push("git push origin <branch> && Render Dashboard → Manual Deploy → Clear build cache");
  }
  if (migrationStatus !== "OK" || schemaOk === false) {
    report.recommendedActions.push("Render Shell or deploy hook: cd transpak-backend && npm run db:migrate");
  }
  if (dbAudit.lockStuck) {
    report.recommendedActions.push("npm run audit:production-db -- --repair");
  }
  if (!dbTargetMatch && localDb?.host) {
    report.recommendedActions.push("Set Render DATABASE_URL to same Supabase pooler as local .env");
  }

  printSection("Phase 6 — Final verification");
  console.log(JSON.stringify(report, null, 2));

  if (!issues.length) {
    console.log("\nOK: Production aligned with local.");
    process.exit(0);
  }
  for (const i of issues) {
    console.log(`FAIL [${i.type}] ${i.detail}`);
  }
  process.exit(1);
}

function hasDeployMismatch(localDb, data) {
  return (
    Boolean(localDb?.host && data.deploy?.databaseTarget?.host) &&
    localDb.host !== data.deploy.databaseTarget.host
  );
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
