#!/usr/bin/env node
/**
 * D1–D8 API preflight orchestrator — run before manual device signoff.
 */
import { spawnSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";
import { discoverBackendOrigin } from "./discover-backend-port.mjs";

const ROOT = join(import.meta.dirname, "..");
const BACKEND = join(ROOT, "transpak-backend");
const REPORT = join(ROOT, "device-preflight-report.json");
const require = createRequire(join(BACKEND, "package.json"));

require("dotenv").config({ path: join(BACKEND, ".env") });

const discovered = await discoverBackendOrigin();
const baseUrl = (
  process.env.QA_BASE_URL ||
  process.env.TEST_BASE_URL ||
  discovered ||
  "http://127.0.0.1:10100"
).replace(/\/$/, "");

const steps = [
  { id: "D1", label: "Login", cmd: ["node", "--test", "test/smoke.api.test.js"], cwd: BACKEND },
  { id: "D3-D5", label: "Load bid accept chain", cmd: ["node", "scripts/e2e-flow-check.js"], cwd: BACKEND },
  { id: "D7", label: "Notifications", cmd: ["node", "--test", "test/notifications.api.test.js"], cwd: BACKEND },
  { id: "D8", label: "Reviews lifecycle", cmd: ["node", "--test", "test/reviews.lifecycle.test.js"], cwd: BACKEND },
  { id: "profile", label: "Profile address", cmd: ["node", "--test", "test/profile.address.test.js"], cwd: BACKEND }
];

const results = [];
console.log(`[device-preflight] Using ${baseUrl}`);

for (const step of steps) {
  const env = {
    ...process.env,
    QA_BASE_URL: baseUrl,
    INTEGRATION_SERVER_READY: "1",
    DISABLE_LOGIN_RATE_LIMIT: "1"
  };
  const r = spawnSync(step.cmd[0], step.cmd.slice(1), { cwd: step.cwd, env, stdio: "pipe", encoding: "utf8" });
  const status = r.status === 0 ? "PASS" : "FAIL";
  results.push({ id: step.id, label: step.label, status, exitCode: r.status ?? 1 });
  console.log(`[device-preflight] ${step.id} ${step.label}: ${status}`);
  if (status === "FAIL") {
    const tail = (r.stderr || r.stdout || "").trim().split("\n").slice(-5).join("\n");
    if (tail) console.log(tail);
  }
}

mkdirSync(join(ROOT, "deploy"), { recursive: true });
writeFileSync(REPORT, JSON.stringify({ generatedAt: new Date().toISOString(), baseUrl, results }, null, 2));
console.log(`[device-preflight] Wrote ${REPORT}`);
process.exit(results.some((r) => r.status === "FAIL") ? 1 : 0);
