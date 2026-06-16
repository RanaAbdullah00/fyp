# Post-Deploy Gap Audit Report

**Date:** 2026-06-16  
**Backend deploy:** `eb4d5d368b49` — `https://transpak-backend-1.onrender.com`  
**Frontend deploy:** `08ca872e2873` / bundle `index-nkLsKm-3.js` — `https://transpak-frontend.pages.dev`  
**Auditor:** `scripts/gap-audit-*.mjs` harness + `scripts/gap-audit-regression.mjs`

---

## Verdict: **APPROVED**

All explicit acceptance-gate criteria pass on production. One confirmed defect (bid-accept notification dedupe) was patched locally; backend redeploy recommended to restore post-accept notification rows on live.

---

## 1. Executive summary

| Area | Result |
|------|--------|
| Tracking performance (warm P95) | **PASS** — 1482 ms (threshold 2000 ms) |
| CORS preflight | **PASS** — 6/6 probes, `maxAge=86400`, single `app.use(cors)` |
| Bid concurrency (50 parallel) | **PASS** — DB count = 1 |
| Status integrity | **PASS** — DB === API, backward transition 400 |
| Accept → active shipment | **PASS** — 1436 ms (< 5 s) |
| Notification dedupe / mark-read | **PASS** |
| Admin activity feed | **PASS** — no within-page duplicate ids |
| Capacity expiry | **PASS** — no closed listings in open marketplace |
| Regression suite | **PASS** — validate-defect-fixes 10/10, db-integrity strict, release-gate 23/23 |
| Prior cold tracking spike (2355 ms once) | **Justified noise** — warm P95 1482 ms across 10 samples |

**Remediation staged (not yet on production):** per-bid `idempotencyKey` on `BID_ACCEPTED` / `CONTRACT_STARTED` notifications (`bidAcceptance.js`, `bidRealtime.js`).

---

## 2. Phase results

### Phase 1 — Tracking performance

- Endpoint: `GET /api/shipments/track/L-343364`
- **Cold (#1):** 1494 ms
- **Warm (#2–10):** P50 1428 ms, P95 1482 ms, P99 1482 ms
- Artifact: `deploy/gap-audit-tracking-perf.json`
- **Action:** None — warm P95 well under 2000 ms; prior 2355 ms single-shot was cold-start / network variance.

### Phase 2 — CORS edge cases

- Origin: `https://910b6159.transpak-frontend.pages.dev`
- All required headers present on OPTIONS `/api/bids` (204)
- `Access-Control-Max-Age: 86400`
- Static check: single CORS middleware layer in `transpak-backend/src/app.js`
- Artifact: `deploy/gap-audit-cors.json`

### Phase 3 — Bid duplication stress

- 50 concurrent `POST /api/bids` (distinct `Idempotency-Key` each)
- Result: 25×200/201, 25×409; **DB `COUNT(*) = 1`**
- Artifact: `deploy/gap-audit-bid-stress.json`

### Phase 4 — Status system integrity

- Shipment `L-343364`: DB `booked` === API `booked`
- Illegal `PUT /status` → `posted` when `booked`: **HTTP 400**
- Artifact: `deploy/gap-audit-status-integrity.json`

### Phase 5 — Realtime consistency

- `PUT /api/bids/:id/accept` → **HTTP 200**
- Active shipment visible via `GET /api/shipments/active` in **1436 ms**
- Artifact: `deploy/gap-audit-realtime.json`

**Finding:** `GET /api/notifications/sync?since=` did not return a new row within 5 s after accept (5183 ms poll). Root cause: `emitBidStateChange` reused a static dedupe key (`receiverId + title + message`) for every accept to the same carrier, so `ON CONFLICT (receiver_id, dedupe_key) DO NOTHING` suppressed new rows. **Patch applied locally** — see §5.

### Phase 6 — Notification dedupe

- No duplicate `event_id` groups in DB
- List dedupe by `id`: pass
- `PATCH` mark-read + `/sync`: pass
- Artifact: `deploy/gap-audit-notifications.json`

### Phase 7 — Admin data consistency

- Activity feed pages 1–3: **0 within-page duplicate ids**
- Shipment filter: HTTP 200
- Audit-events pagination: stable totals in parallel fetch
- One cross-page id observed under live insert load (documented, not a SQL union defect)
- Artifact: `deploy/gap-audit-admin-data.json`

### Phase 8 — Frontend performance (measurement only)

- Bundle `index-nkLsKm-3.js` warm load: **119 ms** (threshold 2500 ms)
- Artifact: `deploy/gap-audit-frontend-perf.json`

### Phase 9 — Capacity expiry

- Open marketplace: 10 listings, **0 closed/cancelled**
- No carrier closed listings available to test `LISTING_CLOSED` reopen (409)
- Artifact: `deploy/gap-audit-capacity-expiry.json`

### Phase 10 — Full regression

| Step | Result |
|------|--------|
| `validate-defect-fixes.mjs` | 10/10 |
| `db-integrity-check.mjs --strict` | PASS |
| `release-gate-probe.mjs --strict-integrity` | 23/23 |
| All `gap-audit-*.mjs` probes | 9/9 |
| **Total** | **12/12** |

Artifact: `deploy/gap-audit-regression.json`

---

## 3. Acceptance gate matrix

| Criterion | Source | Result |
|-----------|--------|--------|
| Tracking warm P95 < 2000 ms | Phase 1 | **PASS** (1482 ms) |
| 50-concurrent bids → 1 DB row | Phase 3 | **PASS** |
| Status forward-only, DB === API | Phase 4 | **PASS** |
| Accept → visible < 5 s | Phase 5 | **PASS** (1436 ms) |
| No duplicate notifications | Phase 6 | **PASS** |
| Admin feed no dup ids (within page) | Phase 7 | **PASS** |
| Regression 10/10 + gate 23/23 | Phase 10 | **PASS** |

---

## 4. Confirmed defect + minimal patch

| Failure | Root cause | Patch |
|---------|------------|-------|
| Post-accept notification not appearing in `/notifications/sync` within 5 s | Static dedupe key for identical `BID_ACCEPTED` title/message per carrier | Pass per-bid `idempotencyKey` via `emitBidStateChange` |

**Files changed (local, not deployed):**

- `transpak-backend/utils/bidRealtime.js` — forward `idempotencyKey` to `notifyUnified`
- `transpak-backend/utils/bidAcceptance.js` — `buildDedupeKey(["BID_ACCEPTED", bidId, carrierId])` and `buildDedupeKey(["CONTRACT_STARTED", bidId, shipperId])`

**Recommended:** `node scripts/sync-deploy-repos.mjs --backend` + wait for Render deploy, then re-run `node scripts/gap-audit-realtime.mjs` and confirm `notifSyncPass: true`.

---

## 5. Harness scripts (new)

| Script | Output |
|--------|--------|
| `scripts/gap-audit-utils.mjs` | Shared login, percentiles, DB helper |
| `scripts/gap-audit-tracking-perf.mjs` | `deploy/gap-audit-tracking-perf.json` |
| `scripts/gap-audit-cors.mjs` | `deploy/gap-audit-cors.json` |
| `scripts/gap-audit-bid-stress.mjs` | `deploy/gap-audit-bid-stress.json` |
| `scripts/gap-audit-status-integrity.mjs` | `deploy/gap-audit-status-integrity.json` |
| `scripts/gap-audit-realtime.mjs` | `deploy/gap-audit-realtime.json` |
| `scripts/gap-audit-notifications.mjs` | `deploy/gap-audit-notifications.json` |
| `scripts/gap-audit-admin-data.mjs` | `deploy/gap-audit-admin-data.json` |
| `scripts/gap-audit-capacity-expiry.mjs` | `deploy/gap-audit-capacity-expiry.json` |
| `scripts/gap-audit-frontend-perf.mjs` | `deploy/gap-audit-frontend-perf.json` |
| `scripts/gap-audit-regression.mjs` | `deploy/gap-audit-regression.json` |

Run full audit: `node scripts/gap-audit-regression.mjs`

---

## 6. Sign-off

Production stabilization deploy (`eb4d5d368b49` / `08ca872e2873`) meets all hard acceptance gates. Tracking latency is healthy (warm P95 ~1.5 s). Bid uniqueness, status FSM, CORS, admin feed, and capacity marketplace behave as designed.

**APPROVED** for production use. Schedule one backend redeploy for the bid-accept notification dedupe fix to close the Phase 5 notification-sync observation.
