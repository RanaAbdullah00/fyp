# TransPAK Production Gap Report

**Date:** 2026-06-18  
**Pass:** Zero-Gap Production Audit  
**Decision:** **CONDITIONAL GO** (automated fixes complete; manual D1–D8 and integration cooldown pending)

---

## Executive summary

Independent audit confirmed prior certification overstated completion. Critical capacity-close bug (PATCH `status: closed` rejected by backend) is **fixed**. Test bootstrap now health-gates HTTP suites. Dead counter-offer service exports and orphan screens removed. Backend `shipmentRoutes.js` missing `router` declaration (startup crash) **fixed**.

**Automated gates (2026-06-18):**

| Gate | Result |
|------|--------|
| Web `npm run build` | **PASS** (exit 0) |
| Mobile `validate:phase4` / `validate:phase5` | **PASS** (exit 0) |
| Mobile `smoke:phase4` | **PASS** 25 / PARTIAL 3 / FAIL 0 |
| Backend `test:phase8` | **PASS** 20/20 |
| Backend `test:security` static | **PASS** 11/11 (8 HTTP cancelled — login rate limit) |
| Backend full suite (API on `:10000`) | **PARTIAL** 271 pass / 13 fail (rate limit + 2 DB constraint tests) |
| Capacity close POST `/close` | **PASS** (web + mobile wired) |
| Counter UI call sites | **PASS** (grep: 0) |
| Device D1–D8 | **NOT RUN** (user signoff required) |

---

## Critical issues (resolved this pass)

### C1 — Capacity close used forbidden PATCH body

| Field | Detail |
|-------|--------|
| Root cause | Web `MySpaceListings.jsx` and mobile `CarrierSpacePanels.jsx` sent `PATCH { status: 'closed' }`; `rejectForbiddenBodyFields.js` forbids `status` on carrier-space PATCH |
| Files | `transpak-frontend/src/components/carrier/MySpaceListings.jsx`, `transpak-mobile-frontend/src/components/carrier/CarrierSpacePanels.jsx` |
| Impact | Carriers could not close capacity listings (400) |
| Fix | `POST /api/carrier-space/:id/close` and `/reopen` via `carrierSpace.js` (web) and `commercial.js` (mobile) |
| Validation | Grep: no `status: 'closed'` PATCH in UI; smoke `CARRIER_SPACE_LIFECYCLE` PASS |

### C2 — Backend failed to start (`router is not defined`)

| Field | Detail |
|-------|--------|
| Root cause | `router.use(shipmentsRouteLimiter)` before `const router = express.Router()` in `shipmentRoutes.js` |
| Fix | Added `const router = express.Router()` before middleware registration |
| Validation | `npm start` on `:10000` — server listening, schema 033 OK |

### C3 — Integration tests cascaded when API down

| Field | Detail |
|-------|--------|
| Root cause | `hasIntegrationEnv()` enabled HTTP suites without health probe |
| Fix | `test/helpers/serverReachable.js`, `integrationSuiteSkipReason()`, `npm run test:integration`, `scripts/run-all-tests.mjs` |
| Validation | Server down → suites skip cleanly; server up → HTTP suites run |

---

## High issues

### H1 — Orphan ApproveCarrier mobile screen

| Status | **Fixed** |
| Fix | Deleted `ApproveCarrierScreen.jsx`; removed from `AppStack.jsx`; audit scripts updated |

### H2 — Dead AcceptedLoads web page

| Status | **Fixed** |
| Fix | Deleted `AcceptedLoads.jsx`; `/loads/accepted` redirects to `/shipments/active` in `commercialRoutes.jsx` |

### H3 — Dead counter-offer service exports

| Status | **Fixed** |
| Fix | Removed `submitCounterOffer`, `suggestBid`, `suggestCarrierBid`, etc. from web/mobile services; backend returns 410 on suggest routes; legacy read-only “Suggested” badges retained |

### H4 — Integration suite failures under rate limit

| Status | **Open (environmental)** |
| Symptom | Multiple HTTP suites fail with `Too many login attempts` when full suite runs against live API |
| Impact | Cannot claim full green `npm test` without cooldown or test-only rate-limit bypass |
| Mitigation | Run `test:integration` after cooldown; static suites pass independently |

### H5 — Capacity expiry integration test DB constraint

| Status | **Open** |
| Error | `carrier_space_status` check constraint on test insert |
| Impact | 1 failing subtest in `capacity-expiry.integration.test.js` |
| Note | Unrelated to UI close fix; may need test fixture alignment with migration 033 |

---

## Medium issues (documented, not blocking automated deploy)

| ID | Issue | Web | Mobile | Action |
|----|-------|-----|--------|--------|
| M1 | Messages/chat | `Messages.jsx` OK | No Messages screen | Accepted parity gap — do not remove web chat |
| M2 | Profile address/company | `ProfileEditor` no fields | `ProfileScreen` collects | Backend `profileController.js` does not persist `address`/`company_name` |
| M3 | Mobile push notifications | N/A | In-app + socket only | Document N/A |
| M4 | Shipper load close/reopen UI | None | None | Loads transition via bid accept + shipment lifecycle |

---

## Low issues

| ID | Issue | Status |
|----|-------|--------|
| L1 | Withdraw bid | Not implemented — document N/A |
| L2 | Stale i18n counter display strings | OK for historical `counter_offered` rows |
| L3 | Matching engine fleet test failure | 1 static/DB test — investigate separately |

---

## Parity matrix (in-scope flows)

| Flow | Web | Mobile | Status |
|------|-----|--------|--------|
| Accept/Reject bid | OK | OK | Parity |
| Capacity close | POST `/close` | POST `/close` | **Fixed** |
| Capacity reopen | POST `/reopen` | POST `/reopen` | Wired when `status === 'closed'` |
| Messages/chat | OK | Missing | Documented gap |
| Approve carrier guide | Route removed | Screen removed | **Fixed** |
| Invoice/payment | Offline by design | Same | N/A |
| Withdraw bid | N/A | N/A | N/A |
| 4-step shipment timeline | OK | OK | Parity |

---

## State machine mapping

**Canonical shipment statuses** (`transpak-backend/utils/shipmentStatus.js`):

`posted → booked → pickedup → intransit → delivered → closed`

Audit prompt composite (load + bid + shipment):

| Prompt term | Implementation |
|-------------|----------------|
| OPEN | Load `status = open` |
| BIDDED | Open load with pending bids |
| ASSIGNED / BOOKED | Bid accepted; shipment `booked` |
| IN TRANSIT | `pickedup` / `intransit` |
| DELIVERED | `delivered` (still in active list until closed) |
| CLOSED | `closed`; triggers `REVIEW_PROMPT` |

**Capacity listing:** `open | closed | expired` via dedicated POST routes (not PATCH status).

---

## Entry points

| Surface | File |
|---------|------|
| Web routes | `transpak-frontend/src/routes/commercialRoutes.jsx` |
| Mobile stack | `transpak-mobile-frontend/src/navigation/AppStack.jsx` + `MainTabs.jsx` |
| Backend app | `transpak-backend/src/app.js` |

---

## Dead / orphan inventory (post-cleanup)

| Item | Status |
|------|--------|
| `AcceptedLoads.jsx` | Deleted |
| `ApproveCarrierScreen.jsx` (mobile) | Deleted |
| `submitCounterOffer` / `suggestBid` service exports | Removed |
| Legacy bid “Suggested” badge (read-only) | **Kept** |
| Web `Messages.jsx` | **Kept** (mobile gap only) |

---

## Out of scope (this pass)

- Mobile Messages screen
- Payment / invoice online flow
- Withdraw bid
- Profile address/company backend persistence
- Device GPS/socket proof (D2–D4 manual)

---

## Production startup checklist

1. **Env** (from `transpak-backend/.env.example`): `DATABASE_URL`, `JWT_SECRET`, `PORT`, E2E creds for QA
2. **Port discovery:** `scripts/discover-backend-port.mjs` → `.dev-backend-port`
3. **Migrate:** `npm run db:migrate` (schema 033)
4. **Start backend:** `cd transpak-backend && npm start`
5. **Verify health:** `GET /api/health`
6. **Deploy order:** migrate 033 → backend → web → mobile
7. **Automated validation:**
   ```powershell
   cd transpak-frontend; npm run build
   cd transpak-mobile-frontend; npm run validate:phase4; npm run validate:phase5; npm run smoke:phase4
   cd transpak-backend; npm run test:integration
   ```
8. **Manual:** Complete `DEVICE_TEST_TEMPLATE.md` D1–D8

---

## GO / NO-GO criteria

| Criterion | Required for GO (SAFE) | 2026-06-18 |
|-----------|------------------------|------------|
| Web build | exit 0 | **PASS** |
| Mobile validate:phase4/5 | exit 0 | **PASS** |
| smoke:phase4 | FAIL=0 | **PASS** |
| Capacity close POST | verified | **PASS** |
| Counter UI | 0 call sites | **PASS** |
| test:phase8 | pass | **PASS** |
| Full backend npm test | all pass | **PARTIAL** (rate limit) |
| D1–D8 manual | all PASS | **PENDING** |

**Verdict:** **CONDITIONAL GO** — safe to deploy automated fixes; promote to **GO (SAFE)** only after D1–D8 signoff and integration suite green post-cooldown.
