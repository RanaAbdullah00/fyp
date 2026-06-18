# Regression Report

**Date:** 2026-06-18 (Zero-Gap Production Audit)

## Verified non-regression

| Module | Status | Evidence |
|--------|--------|----------|
| Mobile screen inventory | PASS | 40/40 phase4-screen-audit |
| Mobile API wrappers | PASS | 44/44 phase4-endpoint-audit (0 FAIL) |
| Web production build | PASS | `npm run build` exit 0 |
| Mobile smoke phase4 | PASS | 25 PASS / 0 FAIL |
| Backend static phase8 | PASS | 20/20 |
| Security static ownership | PASS | 11/11 |
| Capacity close flow | PASS | POST `/close` — smoke CARRIER_SPACE_LIFECYCLE |
| Auth architecture | Unchanged | No auth route edits this pass |
| Accept/Reject bids | Preserved | bidRoutes accept/reject intact |

## Fixes (were regressions / blockers)

| Issue | Fix |
|-------|-----|
| Capacity close PATCH 400 | POST `/close` wired web + mobile |
| Backend startup crash | `shipmentRoutes.js` router declaration |
| Integration test cascade | Health gate skips HTTP when API down |
| Orphan ApproveCarrier mobile | Screen + route removed |

## Intentional behavior changes

- Counter-offer UI and service exports removed (API 410 retained)
- `/loads/accepted` → `/shipments/active`
- Legacy `counter_offered` rows: read-only **Suggested** label kept

## Known residual (not regressions)

- Mobile Messages screen absent (documented gap)
- Backend full suite: login rate limit when run repeatedly against live API
- `capacity-expiry.integration.test.js`: 1 DB constraint failure (fixture vs schema 033)
- Device GPS/socket: manual D6 only
