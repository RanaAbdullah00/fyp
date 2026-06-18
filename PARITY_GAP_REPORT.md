# Web ↔ Mobile Parity Gap Report

**Date:** 2026-06-17  
**Scope:** Commercial shipper/carrier workflows (excludes `/admin/*`, `/messages`)

---

## Screen inventory

| Web route | Mobile screen | Status |
|-----------|---------------|--------|
| `/loads/post` | `PostLoadScreen` | PASS |
| `/loads/manage` | `LoadsHubScreen` | PASS |
| `/loads/:id/edit` | `EditLoadScreen` | PASS |
| `/loads/:id` | `LoadDetailsScreen` | PASS |
| `/carrier/space/post` | `PostCarrierSpaceScreen` | PASS |
| `/bids` | `ShipperBidsScreen` | PASS |
| `/bids/mine` | `CarrierMyBidsScreen` | PASS |
| `/bids/place` | `PlaceBidScreen` | PASS |
| `/bids/approve` | `ApproveCarrierScreen` | PASS |
| `/fleet` | `FleetMonitoringScreen` | PASS |
| `/carrier/truck-details` | `TruckDetailsScreen` (tab) | PASS |
| `/carrier/verification` | `CarrierVerificationScreen` | PASS |
| `/shipments/active` | `ShipmentsActiveScreen` | PASS |
| `/shipments/tracking` | `ShipmentTrackingScreen` | PASS (map fixed) |
| `/shipments/history` | `ShipmentHistoryScreen` | PASS |
| `/profile` | `ProfileScreen` | PASS |
| `/profile/u/:id` | `PublicProfileScreen` | PASS |
| `/settings` | `SettingsScreen` | PASS |
| `/support` | `SupportScreen` | PASS |
| `/feedback` | `FeedbackScreen` | PASS |
| `/notifications` | `NotificationsScreen` | PASS |
| `/operations/activity` | `OperationsActivityScreen` | PASS |
| `/messages` | — | **Missing** (out of scope) |
| `/admin/*` | — | **Missing** (out of scope) |
| `/fleet/add` | Via TruckDetails tab | PARTIAL (no dedicated route; same workflow) |

**Screen coverage:** 40/40 commercial mobile screens PASS (phase4-screen-audit)

---

## API parity

| Area | Web | Mobile | Status |
|------|-----|--------|--------|
| Auth | `authService.js` | `auth.js` | PASS |
| Commercial | page `request` + services | `commercial.js` | PASS (44 wrappers) |
| Upload | `uploadApi.js` | `uploadMedia.js` | PASS |
| Chat | `chatApi.js` (5 endpoints) | — | **Missing** (out of scope) |
| Replay/telemetry | debug endpoints | — | LOW_GAP (3) |
| Runtime i18n | `POST /translations/runtime` | static `translations.js` | PARTIAL |

---

## Business rule mismatches

| Rule | Web | Mobile | Severity | Fixed |
|------|-----|--------|----------|-------|
| Feedback payload | `{ subject, message }` | Same | — | Prior pass |
| Capacity realtime | `space:join` | Was missing | Medium | **Fixed** |
| Dispatch refresh scope | `notificationPipeline` type map | Was broken object scope | High | **Fixed** |
| Tracking refKey | `getAuthoritativeTrackRef` | Was `refKey\|\|id` | Medium | **Fixed** |
| Shipper counter bid | UI removed (409) | Same | — | Aligned |
| CNIC doc upload | Full UI | API only, no UI | Low | Open |
| Admin fleet approval | Web admin | Mobile creates `pending` | Backend dep | Open |
| Theme toggle | Settings only | Header + Settings | Low | Intentional |
| Login role labels | i18n | Was English capitalize | Low | **Fixed** |

---

## Validation rule parity (screen-level)

| Form | Aligned |
|------|---------|
| PostLoad required fields | Yes |
| PostCarrierSpace city/weight | Yes |
| Bid place amount | Yes |
| Feedback subject required | Yes |
| EditLoad fetch error handling | Yes |

---

## Remaining gaps (not fixed — by design)

1. Messages/chat — 5 API endpoints, no mobile screen
2. Mobile admin moderation
3. CNIC front/back upload UI on Profile
4. Causal replay debug API
5. Web `trackingJoinQueue` / `useLiveLocation` movement threshold (mobile uses simpler inline GPS)
6. `registerRefreshHandler` single-consumer-per-scope vs web event bus

---

## Evidence

- `phase4-screen-audit.json`: 40 PASS
- `phase4-endpoint-audit.json`: 44 PASS, 3 LOW_GAP
- `smoke:phase4` production: 23 PASS, 0 FAIL
