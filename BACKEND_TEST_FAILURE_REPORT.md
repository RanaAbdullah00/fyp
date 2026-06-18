# Backend Test Failure Report

**Date:** 2026-06-17  
**Command:** `npm test` in `transpak-backend`  
**Target API:** Production (`https://transpak-backend-1.onrender.com`) when `E2E_*` credentials set

---

## Executive summary

| Run | Pass | Fail | Cancelled | Notes |
|-----|------|------|-----------|-------|
| **Before** `.env` E2E aliases | 259 | 6 | 55 | All 6 = hook `Valid email is required` |
| **After** `.env` aliases (isolated suites) | — | 2 residual | 0 | See below |
| **After** `.env` aliases (full `npm test`) | 304 | 14 | 7 | Rate-limit + test-data flakes |

**Fix applied:** Added `E2E_SHIPPER_EMAIL`, `E2E_CARRIER_EMAIL`, `E2E_ADMIN_EMAIL` and password aliases to [`transpak-backend/.env`](transpak-backend/.env) mirroring `E2E_*_ONLY_EMAIL` + `PHASE1_RBAC_PASSWORD`.

**Production code changes:** None (no Class C bugs proven).

---

## Original 6 failing suites (resolved hook failures)

| # | Suite | File | Test / hook | Exact error | Root cause | Class | Production impact | Severity | Recommendation |
|---|-------|------|-------------|-------------|------------|-------|-------------------|----------|----------------|
| 1 | Admin audit API HTTP | `test/admin-audit.api.test.js` | `before()` | `Valid email is required` | `process.env.E2E_SHIPPER_EMAIL` undefined; only `E2E_SHIPPER_ONLY_EMAIL` set | **D** Config | None | High (test blocked) | **Fixed** — `.env` aliases |
| 2 | Bid concurrency stress | `test/bid-concurrency.stress.test.js` | `before()` | same | same | **D** | None | High | **Fixed** hook; see residual #8 |
| 3 | Notifications safety | `test/notifications.api.test.js` | `before()` | same | same | **D** | None | High | **Fixed** — suite now **7/7 PASS** |
| 4 | Performance safety | `test/performance.safety.test.js` | carrier load test | same | `E2E_CARRIER_EMAIL` undefined | **D** | None | Medium | **Fixed** — suite now **7/7 PASS** |
| 5 | Admin dashboard timing | `test/performance.safety.test.js` | `before()` admin tests | same | `E2E_ADMIN_EMAIL` undefined | **D** | None | Medium | **Fixed** |
| 6 | (55 cancelled) | various | child tests | `cancelledByParent` | Cascade from hooks 1–5 | **D** | None | — | Resolved with hook fix |

---

## Residual failures after env fix

### Isolated suite results

| Suite | Result | Residual issue |
|-------|--------|----------------|
| `admin-audit.api.test.js` | 5/6 pass | 1 assertion failure (see #7) |
| `bid-concurrency.stress.test.js` | 0/1 pass | Profile gate (see #8) |
| `notifications.api.test.js` | **7/7 PASS** | — |
| `performance.safety.test.js` | **7/7 PASS** | — |

### Detailed residual items

| # | File | Test name | Exact error | Root cause | Class | Production impact | Severity | Fix recommendation |
|---|------|-----------|-------------|------------|-------|-------------------|----------|-------------------|
| 7 | `admin-audit.api.test.js` L80 | admin can access audit-events when credentials provided | `assert.ok(Array.isArray(res.body?.data?.rows)...)` falsy | Test uses `res.body`; [`helpers/http.js`](transpak-backend/test/helpers/http.js) returns `res.payload` / `res.data`, not `res.body` | **A** Test bug | None — HTTP 200 returned | Low | Change assertion to `res.payload` or `res.data?.data` (test-only) |
| 8 | `bid-concurrency.stress.test.js` | 100 parallel submissions create exactly one bid row | `E2E shipper profile incomplete` | Production test shipper account fails profile-complete gate on `POST /api/loads` | **B** Environment / test data | None for deployed users with complete profiles | Medium | Seed complete profile for phase1 shipper on production DB, or run against local backend with seeded users |
| 9 | Multiple HTTP suites (full run) | various hooks/tests | `Too many login attempts, please try again later` (HTTP 429) | Running 325 tests sequentially against production triggers auth rate limiter | **B** Environment | Rate limit is intentional production protection | Medium | Run integration tests against local backend (`QA_BASE_URL=http://127.0.0.1:10000`) or stagger/throttle logins; do not weaken rate limit in production |
| 10 | `phase1-signoff.test.js`, `security.ownership.test.js`, `smoke.api.test.js`, etc. | HTTP subtests | 429 / profile incomplete / cancelled | Combination of #8 and #9 during full suite | **B** | None proven | Medium | Document; use local integration target for CI |

---

## Suites that pass reliably after env fix

- All **static** tests (security helpers, schema guards, phase static audits) — unchanged PASS
- `notifications.api.test.js` — **PASS** (dedupe, unread, sync)
- `performance.safety.test.js` — **PASS** (when run isolated)
- `security.ownership.test.js` static section — **PASS**

---

## Classification legend

| Class | Meaning |
|-------|---------|
| A | Test issue only |
| B | Environment / test data / rate limit |
| C | Production bug |
| D | Configuration issue |

**No Class C (production bug) failures were proven in this investigation.**

---

## Evidence commands

```bash
cd transpak-backend
node --test test/notifications.api.test.js    # 7 pass after fix
node --test test/performance.safety.test.js     # 7 pass after fix
node --test test/admin-audit.api.test.js        # 5 pass, 1 fail (res.body)
node --test test/bid-concurrency.stress.test.js # 1 fail (profile gate)
npm test                                        # 304 pass / 14 fail / 7 cancelled (rate limit during full run)
```
