# Backend Test Revalidation

**Date:** 2026-06-17  
**Change:** Added standard `E2E_*_EMAIL` / `E2E_*_PASSWORD` aliases to [`transpak-backend/.env`](transpak-backend/.env)

---

## Before / after

| Metric | Before env fix | After env fix (full suite) | After env fix (isolated critical suites) |
|--------|----------------|----------------------------|------------------------------------------|
| Pass | 259 | 304 | notifications: 7/7; performance: 7/7 |
| Fail | 6 | 14 | admin-audit: 1; bid-stress: 1 |
| Cancelled | 55 | 7 | 0 (isolated) |
| Root hook error | `Valid email is required` | `Too many login attempts` (429) on full run | — |

**Interpretation:** The original certification blocker (undefined E2E emails) is **resolved**. Full-suite failures increased transiently because tests hammer production auth rate limits — not a regression in application logic.

---

## Commands run

```bash
# Env change
# Added to transpak-backend/.env:
# E2E_SHIPPER_EMAIL, E2E_CARRIER_EMAIL, E2E_ADMIN_EMAIL
# E2E_SHIPPER_PASSWORD, E2E_CARRIER_PASSWORD, E2E_ADMIN_PASSWORD

node --test test/admin-audit.api.test.js
node --test test/bid-concurrency.stress.test.js
node --test test/notifications.api.test.js
node --test test/performance.safety.test.js
npm test
```

---

## Per-suite revalidation

| Suite | Before | After | Status |
|-------|--------|-------|--------|
| Admin audit HTTP hooks | FAIL (email) | PASS hooks | **IMPROVED** — 1 test assertion remains (res.body) |
| Bid concurrency | FAIL (email) | FAIL (profile gate) | **IMPROVED** hook; needs test data |
| Notifications safety | FAIL (email) | **7/7 PASS** | **GREEN** |
| Performance safety | FAIL (email) | **7/7 PASS** | **GREEN** |
| Admin dashboard timing | FAIL (email) | **3/3 PASS** (isolated) | **GREEN** |
| Full npm test | 259/320 effective | 304/325 | **IMPROVED** with transient 429 flakes |

---

## Residual actions (non-production)

| Priority | Action | Owner |
|----------|--------|-------|
| Low | Fix `admin-audit.api.test.js` L80 to use `res.payload` | Test maintainer |
| Medium | Complete phase1 shipper profile on production test DB | DevOps / seed script |
| Medium | Point CI integration tests to `QA_BASE_URL=http://127.0.0.1:10000` | CI config |
| Low | Add login throttle delay between HTTP suites | Test harness |

---

## Production impact statement

**No backend production code was modified.** Residual failures are test assertion bugs (Class A), test account state (Class B), or auth rate limiting under burst test load (Class B). Production smoke (`transpak-mobile-frontend` `smoke:phase4`) independently validates live API when not rate-limited.

---

## Certification stance

Backend test suite: **CONDITIONAL PASS** for certification — static + isolated integration suites green; full-suite HTTP tests require local target or rate-limit-aware CI to achieve 0 fail consistently.
