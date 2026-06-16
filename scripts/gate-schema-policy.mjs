/**
 * Shared release-gate schema policy — reads required version from schemaGuard (single source of truth).
 */
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const backendRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "transpak-backend");
const { SCHEMA_VERSION } = require(path.join(backendRoot, "db", "schemaGuard.js"));

export const NOTIFICATION_DEDUPE_CONSTRAINT = "uq_notifications_receiver_dedupe_full";

export function getRequiredSchemaVersion() {
  return SCHEMA_VERSION;
}

export function parseSchemaVersion(value) {
  const n = parseInt(String(value ?? ""), 10);
  return Number.isFinite(n) ? n : null;
}

/** True when live schema version is at or above the code-required minimum. */
export function isSchemaVersionAtLeast(actual, minimum = SCHEMA_VERSION) {
  const a = parseSchemaVersion(actual);
  const m = parseSchemaVersion(minimum);
  if (a == null || m == null) return false;
  return a >= m;
}
