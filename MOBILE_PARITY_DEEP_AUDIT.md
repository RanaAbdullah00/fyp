# Mobile Parity Deep Audit

**Date:** 2026-06-17  
**Source of truth:** `transpak-frontend` commercial routes  
**Target:** `transpak-mobile-frontend` screens + services

---

## Legend

| Status | Meaning |
|--------|---------|
| **PASS** | Workflow present; API + UI wired; static/smoke evidence |
| **PARTIAL** | Present but gap (device, UI, or realtime) |
| **MISSING** | No mobile equivalent |

---

## Workflow matrix

| # | Workflow | Status | Web | Mobile | Evidence |
|---|----------|--------|-----|--------|----------|
| 1 | Registration | **PASS** | `RegisterForm` | `RegisterScreen` | phase4-screen; smoke auth |
| 2 | OTP verification | **PASS** | `VerifyEmail` | `VerifyOtpScreen` | email param guard |
| 3 | Login | **PASS** | `Login` | `LoginScreen` | smoke AUTH_LOGIN |
| 4 | Forgot / reset password | **PASS** | auth routes | `ForgotPasswordScreen` | static |
| 5 | Add role | **PASS** | profile | `ProfileScreen` + `addRole` | phase5 G |
| 6 | Switch role | **PASS** | header/settings | `MobileHeader` + `roleSwitch.js` | smoke ROLE_SWITCH |
| 7 | Profile view/edit | **PARTIAL** | `Profile.jsx` | `ProfileScreen.jsx` | CNIC upload UI missing |
| 8 | Public profile | **PASS** | `/profile/u/:id` | `PublicProfileScreen` | i18n fixed |
| 9 | Post load | **PASS** | `PostLoad` | `PostLoadScreen` | smoke POST_LOAD |
| 10 | Browse / filter loads | **PASS** | `LoadsHub` | `LoadsHubScreen` | smoke MARKETPLACE |
| 11 | Load details | **PASS** | `LoadDetails` | `LoadDetailsScreen` | static |
| 12 | Edit load | **PASS** | `EditLoad` | `EditLoadScreen` | fetch error handling |
| 13 | Place bid | **PASS** | `PlaceBid` | `PlaceBidScreen` | static |
| 14 | Accept / reject bid | **PASS** | `BidManagement` | `ShipperBidsScreen` | phase5 E |
| 15 | Counter bid | **PASS** | carrier suggest | `CarrierMyBidsScreen` | static |
| 16 | Capacity marketplace | **PASS** | `LoadsHub` capacity tab | `CapacityMarketplacePanel` | smoke CARRIER_SPACE |
| 17 | Post capacity | **PASS** | `PostCarrierSpace` | `PostCarrierSpaceScreen` | smoke POST |
| 18 | Capacity requests | **PASS** | `SpaceRequestsPanel` | `SpaceRequestsPanel` | space:join fixed |
| 19 | Active shipments | **PASS** | `ShipmentsActive` | `ShipmentsActiveScreen` | smoke SHIPMENTS_ACTIVE |
| 20 | Shipment tracking | **PARTIAL** | `ShipmentTracking` | `ShipmentTrackingScreen` | MapTracker fixed; device GPS unverified |
| 21 | Shipment history | **PASS** | `ShipmentHistory` | `ShipmentHistoryScreen` | static |
| 22 | Status advance | **PASS** | tracking UI | `advanceShipmentStatus` | static |
| 23 | Register truck | **PASS** | `TruckDetails` | `TruckDetailsScreen` | smoke TRUCKS |
| 24 | Fleet monitoring | **PASS** | `FleetMonitoring` | `FleetMonitoringScreen` | static |
| 25 | Truck upload / default | **PARTIAL** | upload UI | `uploadMedia` wired | device picker unverified |
| 26 | Notifications | **PASS** | `Notifications` | `NotificationsScreen` | smoke NOTIFICATIONS |
| 27 | Reviews | **PASS** | review prompt | `ReviewPromptHost` | smoke REVIEWS |
| 28 | Settings | **PASS** | `Settings` | `SettingsScreen` | i18n |
| 29 | Support / FAQ | **PASS** | `Support` | `SupportScreen` | FAQ i18n |
| 30 | Feedback | **PASS** | `Feedback` | `FeedbackScreen` | subject+message contract |
| 31 | Messages / chat | **MISSING** | `/messages` | — | Out of scope |
| 32 | Admin | **MISSING** | `/admin/*` | — | Out of scope |

---

## PARTIAL items — detail

### P1 — Profile CNIC document upload

| Field | Value |
|-------|-------|
| File | `ProfileScreen.jsx` — no CNIC front/back picker |
| Cause | `updateProfileFormData` exists; UI not built |
| Web | Full CNIC upload in profile |
| Fix | Add document pickers (out of closure scope) |
| Severity | Low |

### P2 — Shipment tracking (device runtime)

| Field | Value |
|-------|-------|
| Files | `ShipmentTrackingScreen.jsx`, `MapTracker.jsx` |
| Cause | GPS/socket require physical device proof |
| Fix | Device test script (see DEVICE_READINESS_REPORT) |
| Severity | Medium (certification) |

### P3 — Image upload (device)

| Field | Value |
|-------|-------|
| Files | `ProfileScreen.jsx`, `TruckDetailsScreen.jsx` |
| Cause | `expo-image-picker` wired; not CI-verified |
| Fix | Manual device upload test |
| Severity | Low |

---

## Intentional differences (not gaps)

| Item | Web | Mobile |
|------|-----|--------|
| Theme toggle | Settings | Header + Settings |
| Auth branding | Wordmark variants | `BrandLogo` wordmark |
| Admin | Full dashboard | None |
| Runtime Urdu API | `POST /translations/runtime` | Static `translations.js` |

---

## Parity score

| Metric | Value |
|--------|-------|
| Workflows audited | 32 |
| PASS | 27 |
| PARTIAL | 3 |
| MISSING (in scope) | 0 |
| MISSING (excluded) | 2 (chat, admin) |
| **Commercial parity** | **27/30 = 90%** strict; **93%** excluding device-only PARTIAL runtime |

Evidence: phase4-screen-audit 40/40 PASS, smoke:phase4 production (baseline 23 PASS / 0 FAIL).
