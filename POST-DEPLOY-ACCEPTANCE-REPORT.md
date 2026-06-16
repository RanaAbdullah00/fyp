# TransPAK Post-Deploy Real User Acceptance Report

**Date:** 2026-06-16  
**Production API:** https://transpak-backend-1.onrender.com  
**Production UI:** https://transpak-frontend.pages.dev  
**Backend commit:** `77f286d5cf73` | **Frontend commit:** `351e0a23fac2` | **Schema:** `030`  
**Accounts:** Phase1 RBAC (`transpak.phase1.*@example.com`)  
**Artifacts:** `deploy/post-deploy-audit-api.json`, `deploy/post-deploy-audit-mobile.json`, `deploy/release-blocker-tracking.json`

---

## 1. Screens Tested

| Screen | URL | Role | Viewport | Result |
|--------|-----|------|----------|--------|
| Login | `/login` | — | 320–1024px | PASS (HTML 200, viewport meta present) |
| Shipper Dashboard | `/dashboard/shipper` | shipper | API verified | PASS |
| Carrier Dashboard | `/dashboard/carrier` | carrier | API verified | PASS |
| Post Load | `/loads/post` | shipper | API verified | PASS (15 tons → 15000 kg stored) |
| Loads Manage | `/loads/manage` | shipper/carrier | bundle markers | PASS |
| Shipment History | `/shipments/history` | shipper | API 575ms | PASS |
| Shipment Tracking | `/shipments/tracking/L-174278` | shipper/carrier | API 200 | PASS |
| My Bids | `/bids/mine` | carrier | API 200 (2 bids) | PASS |
| Admin Dashboard | `/admin/dashboard` | admin | bundle markers | PASS |
| Admin Audit Log | `/admin/audit` | admin | API 200 (20 rows) | PASS |
| Admin Activity Center | `/admin/activity` | admin | API **500** | **FAIL** |
| Admin Notifications | `/admin/notifications` | admin | API 200 (141 rows) | PASS (read actions fail) |
| Admin Fleet Queue | `/admin/fleet` | admin | API 200 | PASS |
| Truck Management | `/carrier/trucks` | carrier | `/api/trucks/mine` 200 | PASS (UI route correct) |
| Capacity Post | `/carrier/space/post` | carrier | API 201 | PASS |
| Role Switch | navbar control | dual | API verified | PASS |

---

## 2. User Flows Tested

| Phase | Flow | Result |
|-------|------|--------|
| **P0 Baseline** | Deploy chain strict, release gate 23/23, smoke 5/5, tracking 7/7 | PASS |
| **P1 Admin** | Login, dashboard widgets, audit log, notifications list, fleet queue | **PARTIAL** (activity 500, mark-read 500) |
| **P2 Shipper** | Dashboard, create load, visibility, history, notifications, tracking | PASS |
| **P3 Carrier** | Dashboard, capacity post, my bids, tracking | **PARTIAL** (close listing 400; bid 500) |
| **P4 E2E** | Shipper load → carrier bid → accept → shipment | **FAIL** (bid placement 500) |
| **P5 Counter** | Carrier suggest-carrier flow | **FAIL** (bid placement 500) |
| **P6 Expiry** | 15-min capacity listing created; auto-expire wait skipped in timed run | **PARTIAL** (create OK; expiry not waited) |
| **P7 Role Switch** | Dual account KPI isolation, role switch, cross-role notifications | PASS |
| **P8 Mobile** | Static responsive audit 320/375/768/1024 | PASS (4/4) |
| **P9 Console** | Bundle static analysis; no Playwright browser session | PARTIAL (see §4) |

**API audit score:** 30/38 checks passed (`deploy/post-deploy-audit-api.json`)

---

## 3. APIs Tested

| Method | Endpoint | Status | Notes |
|--------|----------|--------|-------|
| GET | `/api/health` | 200 | schema=030, db=ready |
| POST | `/api/auth/login` | 200 | All 4 Phase1 accounts |
| GET | `/api/admin/dashboard/live` | 200 | totalUsers=20 |
| GET | `/api/admin/dashboard/widgets/audit` | 200 | |
| GET | `/api/admin/audit-events` | 200 | 20 rows |
| GET | `/api/admin/activity-feed` | **500** | `column s.carrier_id does not exist` |
| GET | `/api/admin/notifications` | 200 | 141 platform rows |
| PATCH | `/api/admin/notifications/:id/read` | **500** | `column notifications.updated_at does not exist` |
| PATCH | `/api/admin/notifications/read-all` | **500** | Same missing column |
| GET | `/api/admin/fleet/trucks` | 200 | pending=0 |
| GET | `/api/operations/snapshot?viewAs=shipper` | 200 | active=1 |
| GET | `/api/operations/snapshot?viewAs=carrier` | 200 | active=1 |
| GET | `/api/shipments/history` | 200 | 575ms |
| GET | `/api/shipments/active` | 200 | count=1, no duplicates |
| GET | `/api/shipments/track/L-174278` | 200 | status=pickedup |
| POST | `/api/loads/create` | 201 | L-723105, weightKg=15000 |
| GET | `/api/loads/mine` | 200 | audit load visible |
| GET | `/api/trucks/mine` | 200 | 1 approved truck |
| POST | `/api/carrier-space` | 201 | capacity + expiry listings |
| GET | `/api/carrier-space/mine` | 200 | |
| PATCH | `/api/carrier-space/:id` | **400** | close with `{status:'closed'}` only |
| POST | `/api/bids` | **500** | Blocks E2E and counter flows |
| GET | `/api/bids/mine` | 200 | 2 bids |
| PATCH | `/api/auth/active-role` | 200 | dual shipper→carrier |
| GET | `/api/notifications` | 200 | |
| GET | `/api/notifications/unread-count?includeAllRoles=1` | 200 | |

---

## 4. Console Errors Found

| Source | Error | Route | Severity |
|--------|-------|-------|----------|
| API | `column s.carrier_id does not exist` | `GET /api/admin/activity-feed` | **High** |
| API | `column "updated_at" of relation "notifications" does not exist` | `PATCH /api/admin/notifications/*/read` | **High** |
| API | HTTP 500 (no body captured) | `POST /api/bids` | **High** |
| API | HTTP 404 | `POST /api/routing/directions` (ORS proxy) | Medium |
| Static | No Playwright browser session completed | All UI routes | Low (tooling gap) |
| React | None observed in bundle static scan | — | — |
| Socket | Not tested in headless session | — | Low |

**Allowed / expected:** 401 on unauthenticated probes; Render cold-start latency on first request.

---

## 5. Mobile Issues Found

| Width | Route | Issue | Severity |
|-------|-------|-------|----------|
| 320px | `/login` (HTML) | None — viewport meta present, bundle loads | — |
| 375px | All sampled | None in static audit | — |
| 768px | All sampled | None in static audit | — |
| 1024px | All sampled | None in static audit | — |

**Note:** Static mobile audit verified viewport meta, bundle load, and responsive CSS markers (`dashboard-grid`, `Pagination`, `AdminWidgetShell`) at all four widths. Full interactive overflow/button-visibility testing requires browser DevTools (not completed due to Playwright install limitations in this environment).

---

## 6. Production Defects Found

### D-001 — Admin Activity Feed returns HTTP 500

- **Steps:** Login as admin → `GET /api/admin/activity-feed?type=all`
- **Expected:** 200 with paginated activity items
- **Actual:** HTTP 500 — SQL references `shipments.carrier_id` which does not exist
- **Root cause:** [`adminRoutes.js`](transpak-backend/routes/adminRoutes.js) line 629 joins `users u ON u.id = s.carrier_id`; shipments table has no `carrier_id` — carrier is on `loads.assigned_carrier_id`
- **Fix:** Change join to `LEFT JOIN users u ON u.id = l.assigned_carrier_id`

### D-002 — Admin notification Mark Read / Mark All Read returns HTTP 500

- **Steps:** Admin Notification Chamber → mark one read or mark all read
- **Expected:** HTTP 200, unread count decrements
- **Actual:** HTTP 500 — `column "updated_at" of relation "notifications" does not exist`
- **Root cause:** [`adminRoutes.js`](transpak-backend/routes/adminRoutes.js) lines 211–222 use `SET read = true, updated_at = now()` but `notifications` table has no `updated_at` column
- **Fix:** Remove `updated_at` from UPDATE or add migration for `notifications.updated_at`

### D-003 — Bid placement returns HTTP 500 (blocks E2E + counter flows)

- **Steps:** Carrier places bid on open load (`POST /api/bids` with `loadId` + `amount`, vehicleType=Truck)
- **Expected:** HTTP 201 with bid row
- **Actual:** HTTP 500 — server error (carrier has approved truck with documents in DB)
- **Impact:** Phase 4 E2E and Phase 5 counter-offer cannot complete
- **Fix:** Investigate server logs on Render for bid POST stack trace; likely unhandled exception in bid route or matching engine

### D-004 — ORS routing proxy returns HTTP 404

- **Steps:** `POST /api/routing/directions` without auth
- **Expected:** 401 or 200 with route geometry
- **Actual:** HTTP 404 — route not mounted or wrong path
- **Impact:** Tracking map may not render route polyline
- **Severity:** Medium (tracking payload still returns 200 with status/history)

### D-005 — Capacity listing close returns HTTP 400

- **Steps:** `PATCH /api/carrier-space/:id` with body `{ status: "closed" }` only
- **Expected:** HTTP 200, listing closed
- **Actual:** HTTP 400 — validation error on PATCH body
- **Impact:** Carrier cannot close listing via status-only PATCH (UI may send additional fields)
- **Severity:** Medium — verify UI close flow separately

### D-006 — Phase 6 expiry auto-close not verified in this run

- **Steps:** 15-min capacity listing created (`id=489a7c1e-...`, `visibleUntil=2026-06-16T12:42:22Z`)
- **Expected:** After 16 min, listing status=closed, excluded from marketplace
- **Actual:** Wait skipped (`--skip-expiry-wait` in timed audit run)
- **Severity:** Medium — requires re-run with full 16-minute wait

---

## 7. Severity Summary

| ID | Defect | Severity |
|----|--------|----------|
| D-001 | Admin activity feed HTTP 500 | **High** |
| D-002 | Admin mark-read HTTP 500 | **High** |
| D-003 | Bid placement HTTP 500 | **High** |
| D-004 | ORS routing proxy 404 | Medium |
| D-005 | Capacity close PATCH 400 | Medium |
| D-006 | Expiry auto-close unverified | Medium |

**Critical: 0 | High: 3 | Medium: 3 | Low: 0**

---

## 8. Fix Required?

| ID | Fix Required? | Rationale |
|----|---------------|-----------|
| D-001 | **Yes** | Admin Activity Center page is broken for all users |
| D-002 | **Yes** | Admin cannot mark notifications read — chamber unusable for workflow |
| D-003 | **Yes** | Core commercial flow (bid → accept → shipment) blocked |
| D-004 | Yes (non-blocking) | Map routing degraded; tracking status still works |
| D-005 | Investigate | UI may work if it sends full body; API-only test used minimal payload |
| D-006 | Re-test | Scheduler logic exists; needs 16-min live wait proof |

---

## 9. Release Recommendation

## B. NOT APPROVED

Three **High** severity defects block production acceptance:

1. **Admin Activity Center** (`/admin/activity`) — HTTP 500 on every request due to invalid SQL column `shipments.carrier_id`
2. **Admin Notification mark-read** — HTTP 500 on PATCH due to missing `notifications.updated_at` column
3. **Bid placement** — HTTP 500 prevents shipper/carrier booking workflow (E2E and counter-offer flows cannot complete)

### What passed (ready for use)

- Deploy chain **READY** (strict), release gate **23/23**, smoke **5/5**
- Shipper dashboard, load creation (kg contract), history, tracking
- Carrier dashboard, capacity listing creation, My Bids, tracking on existing shipment
- Dual-role switching with KPI isolation
- DB integrity (0 duplicate/orphan rows)
- Performance P95 &lt; 2000ms on all probed endpoints
- Mobile static responsive markers at 320/375/768/1024px

### Required before re-audit

1. Fix D-001: `s.carrier_id` → `l.assigned_carrier_id` in activity-feed query
2. Fix D-002: Remove or migrate `notifications.updated_at` in admin mark-read routes
3. Fix D-003: Resolve bid POST 500 (check Render logs for stack trace)
4. Re-run: `node scripts/post-deploy-user-audit.mjs` (full, with 16-min expiry wait)
5. Re-run: `node scripts/release-gate-probe.mjs --strict-integrity`

---

*Report generated from automated production API audit + Phase 0 baseline gates. Evidence: `deploy/post-deploy-audit-api.json`.*
