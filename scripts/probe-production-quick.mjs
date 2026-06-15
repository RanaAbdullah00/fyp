#!/usr/bin/env node
const api = process.argv[2] || "https://transpak-backend-1.onrender.com";

async function main() {
  const healthRes = await fetch(`${api}/api/health`, { cache: "no-store" });
  const health = await healthRes.json();
  const d = health?.data || health;
  console.log("[health]", JSON.stringify({
    http: healthRes.status,
    db: d.db,
    dbPing: d.dbPing,
    schemaOk: d.schema?.ok,
    schemaVersion: d.schema?.version,
    migrationRequired: d.migrationRequired,
    build: d.build || d.buildId || d.buildCommit
  }, null, 2));

  const loginRes = await fetch(`${api}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "test@example.com", password: "wrong", roleHint: "shipper" })
  });
  const loginBody = await loginRes.json().catch(() => ({}));
  console.log("[login-bad-pwd]", loginRes.status, loginBody?.error?.code || loginBody?.message || loginBody?.error);

  const statsRes = await fetch(`${api}/api/public/stats`, { cache: "no-store" });
  const statsBody = await statsRes.json().catch(() => ({}));
  console.log("[public-stats]", statsRes.status, statsBody?.error?.code || "ok");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
