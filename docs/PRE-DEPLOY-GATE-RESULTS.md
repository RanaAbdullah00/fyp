# Pre-Deploy Gate Results

**Generated:** 2026-06-13 (post audit remediation)

## Local verification (PASS)

| Gate | Result |
|------|--------|
| `production-stabilization.static.test.js` | **12/12 PASS** |
| `npm test` (backend) | **209 pass, 0 fail** (3 integration suites cancelled — need E2E env) |
| `npm run build` (frontend) | **PASS** — BUILD OK DEPLOY SAFE |

## Audit remediation applied

- Space request status rewind → `SPACE_REQUEST_LOCKED` guard
- Review pending filters `review_prompt_dismissed` + `GET /reviews/dismissed` + client hydrate
- Capacity DELETE blocked when `LISTING_ACTIVE`
- Release probe updated for schema 028+ and `/shipments/history`
- Tracking phone + vehicle type in UI

## Production probe (pre-deploy — expected FAIL until push)

```
node scripts/release-gate-probe.mjs
→ 15/17 PASS
FAIL schema-version (prod schema 027, code expects 028+)
FAIL shipments-history-route (HTTP 404 — route not deployed)
Frontend bundle: index-45q78JT5.js (stabilization bundle not live)
```

## Deploy action required

1. Commit and push backend + frontend to production remotes
2. Render will run `npm run db:migrate` on start (applies migration **029**)
3. Cloudflare Pages rebuild from latest frontend commit
4. Re-run `node scripts/release-gate-probe.mjs` — expect **17/17 PASS**
5. Optional: set `E2E_SHIPPER_ONLY_EMAIL` + `PHASE1_RBAC_PASSWORD` in backend `.env` for ops snapshot + live timing smoke

## Deployment decision after push

Re-run probe; if schema ≥ 028 and `/api/shipments/history` ≠ 404 → **READY FOR PRODUCTION** (pending live E2E sign-off).
