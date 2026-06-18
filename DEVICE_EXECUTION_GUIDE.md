# TransPAK Device Execution Guide (D1–D8)

**Date:** 2026-06-18

Run API preflight before manual device steps:

```powershell
# Terminal 1 — test backend with rate-limit bypass
cd transpak-backend
$env:PORT='10100'; $env:INTEGRATION_SERVER_READY='1'; $env:DISABLE_LOGIN_RATE_LIMIT='1'; npm start

# Terminal 2
cd d:\FYP
$env:QA_BASE_URL='http://127.0.0.1:10100'
node scripts/device-preflight.mjs
```

---

## D1 — Login

| | |
|---|---|
| **Web** | `/login` → dashboard |
| **Mobile** | `Login` screen → `MainTabs` |
| **API** | `POST /api/auth/login` |
| **Preflight** | `test/smoke.api.test.js` login cases |
| **Pass** | Token stored; role workspace correct |
| **Fail points** | Wrong password; rate limit (use test server bypass) |

---

## D2 — Registration + OTP

| | |
|---|---|
| **Web** | `/register` → `/verify-email` |
| **Mobile** | `RegisterScreen` → `VerifyOtpScreen` |
| **API** | `POST /api/auth/register`, OTP verify |
| **Preflight** | Manual only (no automated register in CI) |
| **Pass** | New user verifies and logs in |

---

## D3 — Create load (shipper)

| | |
|---|---|
| **Web** | `/loads/post` |
| **Mobile** | `PostLoad` |
| **API** | `POST /api/loads/create` |
| **Preflight** | `scripts/e2e-flow-check.js` |
| **Pass** | Load appears in My Loads; status `open` |
| **Fail points** | `PROFILE_INCOMPLETE` — complete CNIC docs |

---

## D4 — Place bid (carrier)

| | |
|---|---|
| **Web** | Load details / `/bids/place` |
| **Mobile** | `PlaceBid` / `LoadsHub` |
| **API** | `POST /api/bids` |
| **Preflight** | Part of `e2e-flow-check.js` |
| **Pass** | Bid `pending`; visible in My Bids |
| **Fail points** | `TRUCK_REQUIRED`; vehicle mismatch |

---

## D5 — Accept bid (shipper)

| | |
|---|---|
| **Web** | `/bids` BidManagement |
| **Mobile** | `ShipperBids` |
| **API** | `PUT /api/bids/:id/accept` |
| **Preflight** | `e2e-flow-check.js` accept step |
| **Pass** | Shipment created; load leaves open marketplace |

---

## D6 — Tracking

| | |
|---|---|
| **Web** | `/shipments/tracking/:ref` |
| **Mobile** | `ShipmentTracking` |
| **API** | `GET /api/shipments/track/:ref`, socket `tracking:update` |
| **Preflight** | `e2e-flow-check.js` track GET |
| **Pass** | Map/timeline loads; status updates |
| **Fail points** | Socket reconnect; GPS permissions (see DEVICE_READINESS_REPORT) |

---

## D7 — Notifications

| | |
|---|---|
| **Web/Mobile** | `/notifications`, `NotificationsScreen` |
| **API** | `GET /api/notifications`, unread count, PATCH read |
| **Preflight** | `test/notifications.api.test.js` |
| **Pass** | Unread increments on bid accept; mark-read works |

---

## D8 — Review flow

| | |
|---|---|
| **Web** | `ReviewPromptHost` modal after closed shipment |
| **Mobile** | Profile rate panel / prompt if wired |
| **API** | `GET /api/reviews/pending`, `POST /api/reviews` |
| **Preflight** | `test/reviews.api.test.js` |
| **Pass** | One review per shipment; dismiss persists |

---

## Bonus — Profile address

| | |
|---|---|
| **Web** | Profile → address field |
| **Mobile** | Profile → address (no company field) |
| **API** | `PUT /api/profile/update` with `address` |
| **Preflight** | `test/profile.address.test.js` |
| **Pass** | Address survives refresh and re-login |

---

## Evidence checklist

For each D: screenshot or log, user email used, load/bid/shipment IDs, PASS/FAIL.

Paste results into chat or append to `TEST_EVIDENCE_REPORT.md`.

See also [DEVICE_TEST_TEMPLATE.md](DEVICE_TEST_TEMPLATE.md) for signoff tables.
