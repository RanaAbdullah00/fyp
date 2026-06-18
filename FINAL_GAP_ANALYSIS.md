# TRANSPAK Final Gap Analysis

**Date:** 2026-06-17  
**Projects:** `transpak-backend`, `transpak-frontend`, `transpak-mobile-frontend`  
**Scope:** Commercial shipper/carrier flows (admin mobile and chat explicitly out of scope)

---

## Executive summary

| Dimension | Status | Evidence |
|-----------|--------|----------|
| Mobile screen parity (commercial) | **40/40 PASS**, 2 OUT_OF_SCOPE | `transpak-mobile-frontend/scripts/artifacts/phase4-screen-audit.json` |
| Mobile API wrappers | **44 PASS**, 3 LOW_GAP | `phase4-endpoint-audit.json` |
| Static validation | **PASS** | `validate:phase5` exit 0 |
| HTTP smoke (production) | **23 PASS**, 2 PARTIAL | `npm run smoke:phase4` |
| Device runtime (GPS/socket push) | **Unverified** | phase5-device-code-audit PARTIAL |

**Overall commercial gap posture:** No critical **Broken** items remain after feedback API fix. Largest **Missing** item is chat (deferred). Certification is **CONDITIONAL** until physical-device GPS/socket signoff.

---

## Classification legend

| Tag | Meaning |
|-----|---------|
| **Missing** | Web has feature; mobile has no equivalent |
| **Partial** | Mobile implements subset or weaker UX/realtime |
| **Broken** | Wired incorrectly; API contract mismatch |
| **Unverified** | Code present; no runtime proof in this pass |
| **Device-only** | Requires physical device / GPS / push |
| **Backend dependency** | Requires web admin or server-side action |

---

## Workflow matrix

### Auth

| Feature | Web | Mobile | Status | Notes |
|---------|-----|--------|--------|-------|
| Register | `/register` | `RegisterScreen` | **PASS** | Static audit verified |
| Login | `/login` | `LoginScreen` | **PASS** | |
| OTP verify | `/verify-email` | `VerifyOtpScreen` | **PASS** | Email guard added if param missing |
| Forgot password | `/forgot-password` | `ForgotPasswordScreen` | **PASS** | Combined reset step |
| Reset password | `/reset-password` | (in forgot flow) | **Partial** | No separate route; functionally OK |
| Role select | `/role` | `RoleSelectScreen` | **PASS** | |
| CNIC mask on register | Web formatter | Plain input | **Partial** | UX only |
| Register→OTP E2E | — | — | **Unverified** | Needs device |

### Profile

| Feature | Status | Notes |
|---------|--------|-------|
| View/edit profile | **PASS** | `ProfileScreen` |
| Upload avatar | **PASS** | multipart `updateProfileFormData` |
| Reviews/ratings | **PASS** | `ProfileRateUsersPanel`, review APIs |
| Add role / switch role | **PASS** | Profile + `MobileHeader` |
| CNIC document upload | **Partial** | API exists; no front/back upload UI |
| CNIC lock after verify | **Partial** | Web locks; mobile editable |
| `GET /profile/status` | **Missing** | Backend exists; unused on mobile |

### Loads

| Feature | Status | Notes |
|---------|--------|-------|
| Post load | **PASS** | `PostLoadScreen` + DateField |
| Edit/delete | **PASS** | `EditLoadScreen` with error handling |
| Marketplace browse | **PASS** | `LoadsHubScreen` |
| Filters/search | **PASS** | `LoadFilters` + debounce |
| Load details | **PASS** | `LoadDetailsScreen` |
| Accept/reject/pass (carrier) | **PASS** | `carrierOffer.js` |
| Dedicated accepted loads page | **Partial** | Web `/loads/accepted`; mobile uses `ShipmentsActive` |
| Runtime CRUD | **Unverified** | Smoke verifies profile gate on post |

### Bids

| Feature | Status | Notes |
|---------|--------|-------|
| Place bid | **PASS** | `PlaceBidScreen` |
| Shipper accept/reject | **PASS** | `ShipperBidsScreen`, `LoadDetailsScreen` |
| Carrier counter | **PASS** | `suggest-carrier` flow |
| Shipper counter | **N/A** | Backend disabled (409) — UI removed |
| Bid history tabs | **PASS** | Both bid screens |
| Bid→shipment activation | **Unverified** | Device/smoke partial |

### Shipments

| Feature | Status | Notes |
|---------|--------|-------|
| Active list | **PASS** | `ShipmentsActiveScreen` |
| History | **PASS** | `ShipmentHistoryScreen` |
| Live tracking map | **Device-only** | `ShipmentTrackingScreen` + `LazyMapTracker` |
| Status advance | **PASS** | `advanceShipmentStatus` |
| GPS emit | **Device-only** | expo-location + socket |
| Causal replay | **Missing** | Web debug `GET /replay/shipment/:id` |

### Trucks / fleet

| Feature | Status | Notes |
|---------|--------|-------|
| Add/edit/delete truck | **PASS** | `TruckDetailsScreen` |
| Upload truck card | **PASS** | `POST /upload/media` |
| Set default truck | **PASS** | `PATCH /trucks/:id/default` (mobile ahead of web) |
| Admin fleet approval | **Backend dependency** | Web `/admin/fleet` only |
| Runtime upload | **Unverified** | Needs device with image picker |

### Capacity

| Feature | Status | Notes |
|---------|--------|-------|
| Post capacity | **PASS** | `PostCarrierSpaceScreen` |
| Edit/close listing | **PASS** | `EditCarrierSpaceModal`, PATCH |
| Shipper browse/request | **PASS** | `CapacityMarketplacePanel` |
| Shipper sent requests | **PASS** | `SpaceRequestsPanel direction="sent"` under capacity tab |
| Carrier incoming requests | **PASS** | Incoming-only on requests tab (no 403) |
| In-transit/complete | **PASS** | Sent panel actions |
| `space:join` realtime | **Partial** | Web joins socket room; mobile refresh-on-scope only |
| `DELETE /carrier-space/:id` | **Missing** | Neither client exposes delete (close via PATCH) |

### Notifications

| Feature | Status | Notes |
|---------|--------|-------|
| List / pagination | **PASS** | `NotificationsScreen` |
| Mark read / mark all | **PASS** | commercial.js wrappers |
| Header badge | **PASS** | `MobileHeader` + `AppContext` |
| Socket push | **Device-only** | `notification:new` wired in code |
| Deep link navigation | **Unverified** | `notificationNavigation.js` ported |

### Settings / support

| Feature | Status | Notes |
|---------|--------|-------|
| Theme toggle | **PASS** | Header + Settings |
| Language toggle | **PASS** | Settings |
| Support / FAQ | **PASS** | `SupportScreen` |
| Feedback | **PASS** (fixed) | Now sends `{ subject, message }` per backend |
| Demo video | **Partial** | API wrapper; limited UI |
| Messages/chat | **Missing** (out of scope) | Web `/messages` + 5 chat APIs |

### Explicitly out of scope

| Item | Status |
|------|--------|
| Admin mobile (`/admin/*`) | **OUT_OF_SCOPE** |
| Messages/chat | **OUT_OF_SCOPE** (user decision) |

---

## API crosswalk summary

| Metric | Value | Source |
|--------|-------|--------|
| Mobile endpoint wrappers PASS | 44 | phase4-endpoint-audit |
| LOW_GAP (telemetry/replay/translation) | 3 | Non-blocking |
| Web commercial paths (excl. chat) | ~71 | Manual crosswalk |
| Mobile wrapper coverage (excl. chat) | **~92%** | 44 core + 3 low / ~51 needed |
| Chat endpoints not on mobile | 5 | Deferred |

---

## Broken items (resolved this pass)

| Item | Was | Fix |
|------|-----|-----|
| Feedback API | Mobile sent `category` | `FeedbackScreen` now sends `subject` + `message` matching [`feedbackRoutes.js`](transpak-backend/routes/feedbackRoutes.js) |

---

## Device-only checklist

- [ ] Carrier GPS watch emits `tracking:location` on physical device
- [ ] Shipper receives `tracking:update` and map marker moves
- [ ] Push notification received while app backgrounded
- [ ] Image picker upload for truck cards and profile photo
- [ ] Register → OTP → authenticated session on device

---

## References

- Prior inventory: [`transpak-mobile-frontend/PARITY_AUDIT.md`](transpak-mobile-frontend/PARITY_AUDIT.md)
- Web production audit: [`deploy/GAP-AUDIT-REPORT.md`](deploy/GAP-AUDIT-REPORT.md)
- Screen audit: [`transpak-mobile-frontend/scripts/artifacts/phase4-screen-audit.json`](transpak-mobile-frontend/scripts/artifacts/phase4-screen-audit.json)
- Endpoint audit: [`transpak-mobile-frontend/scripts/artifacts/phase4-endpoint-audit.json`](transpak-mobile-frontend/scripts/artifacts/phase4-endpoint-audit.json)
