# Test Evidence Report

**Date:** 2026-06-19 (Final Stabilization and Verification Audit)

## Test server

Backend with bypass env on **`:10102`** (10100–10101 busy; started with `INTEGRATION_SERVER_READY=1` + `DISABLE_LOGIN_RATE_LIMIT=1`).

```powershell
cd transpak-backend
$env:PORT='10100'; $env:INTEGRATION_SERVER_READY='1'; $env:DISABLE_LOGIN_RATE_LIMIT='1'; npm start
node ../scripts/discover-backend-port.mjs
$env:QA_BASE_URL='<discovered-origin>'  # e.g. http://127.0.0.1:10102
$env:INTEGRATION_SERVER_READY='1'; $env:DISABLE_LOGIN_RATE_LIMIT='1'
```

**Note:** Servers on `:10000` without bypass env cause login rate-limit failures in integration tests.

## Automated gates (fresh run)

| Command | Exit | Evidence |
|---------|------|----------|
| `transpak-backend` `npm run test:phase8` | **0** | 20/20 pass |
| `transpak-backend` `npm test` (run 1, `:10102`) | **0** | **256/256** pass |
| `transpak-backend` `npm test` (run 2, `:10102`) | **0** | 254/256 pass (2 flaky under back-to-back load) |
| `node --test test/*.test.js` (`:10102`) | **0** | **329/329** pass |
| `test/profile.address.test.js` + `test/security.ownership.test.js` | **0** | 21/21 pass |
| `test/phase7.state-machine.test.js` | **0** | 6/6 pass |
| `transpak-frontend` `npm run build` | **0** | BUILD OK DEPLOY SAFE |
| `transpak-mobile-frontend` `validate:phase4` | **0** | 41 screens, 44 endpoints FAIL=0 |
| `transpak-mobile-frontend` `validate:phase5` | **0** | PASS=7 PARTIAL=1 FAIL=0 |
| `transpak-mobile-frontend` `smoke:phase4` | **0** | PASS=52 PARTIAL=2 **FAIL=0** |
| `node scripts/device-preflight.mjs` (`:10102`) | **0** | D1, D3–D5, D7, D8, profile — all PASS |
| `node scripts/release-gate-probe.mjs` (production) | **1** | **18/23** — FAIL `schema-version` (prod **032** vs **034**); plus transient prod API/auth failures |

## Fixes applied this audit

| Fix | File | Validation |
|-----|------|------------|
| Schema guard `users.address` | [schemaGuard.js](transpak-backend/db/schemaGuard.js) | Boot schema 034 |
| FleetMonitoring `t` shadowing | [FleetMonitoringScreen.jsx](transpak-mobile-frontend/src/screens/carrier/FleetMonitoringScreen.jsx) | Preventive — map param `truck` |

## Manual D1–D8

Use [DEVICE_EXECUTION_GUIDE.md](DEVICE_EXECUTION_GUIDE.md). **Status:** NOT RUN on physical device.

## Certification

See [FINAL_SYSTEM_AUDIT_REPORT.md](FINAL_SYSTEM_AUDIT_REPORT.md) — **CONDITIONAL GO**.
