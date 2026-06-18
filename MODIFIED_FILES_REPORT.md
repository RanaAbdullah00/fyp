# Modified Files Report

**Date:** 2026-06-17  
**Pass:** TransPAK Master Implementation + Gap Closure

## Gap closure additions (2026-06-17)

### Web

| File | Change |
|------|--------|
| `src/pages/loads/AvailableLoads.jsx` | Removed counter handler |
| `src/pages/dashboard/CarrierDashboard.jsx` | Removed counter handler |
| `src/components/loadboard/CarrierLoadActions.jsx` | Accept + Reject only (2-col) |
| `src/pages/bids/MyBids.jsx` | Removed suggest/suggestion handlers |
| `src/components/loadboard/BidCard.jsx` | Removed suggest UI |
| `src/components/loadboard/BidList.jsx` | Removed suggest props |
| `src/components/loadboard/LoadList.jsx` / `LoadCard.jsx` | Removed counter props |
| `src/pages/bids/ApproveCarrier.jsx` | **DELETED** |
| `src/routes/commercialRoutes.jsx` | `/loads/accepted` → `/shipments/active` |
| `src/utils/shipmentStatusOptimistic.js` | 4-step timeline filter |
| `src/styles/dashboard.css` | `tp-space-card` theme tokens |
| `src/utils/reviewPrompt.js` | `emitReviewPromptSync` for socket |
| `src/utils/realtimeDispatch.js` | REVIEW_PROMPT → review sync |
| `src/utils/notificationEngine.js` | REVIEW_PROMPT dispatch map |
| `src/utils/notificationPipeline.js` | REVIEW_PROMPT refresh scope |
| `src/utils/notifySystem.js` | Skip duplicate toast for REVIEW_PROMPT |
| `src/components/reviews/ReviewPromptHost.jsx` | `tp:review-prompt-sync` listener |
| `src/i18n/translations.js` | Profile + notifications i18n keys |

### Mobile

| File | Change |
|------|--------|
| `src/screens/shared/LoadsHubScreen.jsx` | Accept + Pass only |
| `src/screens/shared/LoadDetailsScreen.jsx` | Open-only bids; StatusTimeline |
| `src/components/BidCard.jsx` | Accept/Reject only |
| `src/screens/shipper/ShipperBidsScreen.jsx` | Removed onSuggest |
| `src/screens/shared/ProfileScreen.jsx` | `tOr` profile labels |
| `src/services/commercial.js` | `closeCarrierSpace`, `reopenCarrierSpace` |
| `src/i18n/translations.js` | Profile i18n keys |

---

## Backend (`transpak-backend`)

| File | Change summary |
|------|----------------|
| `db/migrations/033_capacity_status_lifecycle.sql` | **NEW** — extended listing/request status enums |
| `db/migrate.js` | Register migration 033 |
| `db/schemaGuard.js` | Schema version → 033 |
| `utils/capacityListingLifecycle.js` | Dedicated close/reopen/expire service + scheduler |
| `utils/spaceRequestState.js` | Extended request transitions |
| `utils/loadExpiry.js` | `expireBidsPastDeadline()` |
| `routes/carrierSpaceRoutes.js` | POST close/reopen/expire; PATCH field-only; DELETE open-only |
| `routes/spaceBookingRoutes.js` | Listing requested on shipper request; deprecated in-transit/complete (410) |
| `routes/shipmentRoutes.js` | Active list includes delivered; review prompt on closed; listing sync |
| `routes/bidRoutes.js` | Counter-offer routes return 410 |

## Web (`transpak-frontend`)

| File | Change summary |
|------|----------------|
| `src/pages/loads/LoadDetails.jsx` | Remove bid lifecycle; booked → tracking CTA only |
| `src/pages/bids/BidManagement.jsx` | Open/Active/History tabs with counts; no counter/suggest |
| `src/components/loadboard/BidCard.jsx` | Suggest disabled; legacy Suggested label retained |
| `src/components/shipment/ShipmentProgressBox.jsx` | 4-step timeline (Booked→Delivered) |
| `src/components/layout/Sidebar.jsx` | Removed Approve Carrier nav |
| `src/components/layout/Navbar.jsx` | Add Role label; removed role badge collision |
| `src/routes/commercialRoutes.jsx` | Removed `/bids/approve` route |
| `src/config/activeRoutes.js` | Removed `/bids/approve` |
| `src/i18n/translations.js` | `nav.addRole`, `pages.bids.bidCount` |

## Mobile (`transpak-mobile-frontend`)

| File | Change summary |
|------|----------------|
| `src/screens/carrier/PostCarrierSpaceScreen.jsx` | Fixed labels/validation (no `t` crash) |
| `src/screens/shipper/ShipperBidsScreen.jsx` | Removed counter tab + approve carrier button |
| `src/screens/carrier/CarrierMyBidsScreen.jsx` | Removed counter-offer UI |
| `src/screens/shared/ShipmentTrackingScreen.jsx` | StatusTimeline wired |
| `src/components/shipment/StatusTimeline.jsx` | 4-step translated timeline |
| `src/services/commercial.js` | Idempotency key on capacity post |

---

## Zero-gap audit additions (2026-06-18)

### Web

| File | Change |
|------|--------|
| `src/services/carrierSpace.js` | **NEW** — `closeCarrierSpace`, `reopenCarrierSpace` (POST) |
| `src/components/carrier/MySpaceListings.jsx` | Wire POST close/reopen (was broken PATCH) |
| `src/components/carrier/CarrierSpaceCard.jsx` | Reopen button when `status === 'closed'` |
| `src/services/carrierLoadOffer.js` | Removed dead `submitCounterOffer` export |
| `src/pages/loads/AcceptedLoads.jsx` | **DELETED** (orphan) |
| `src/i18n/translations.js` | `spaceReopened`, `spaceReopenFailed`, `reopenListing` |

### Mobile

| File | Change |
|------|--------|
| `src/components/carrier/CarrierSpacePanels.jsx` | Wire `closeCarrierSpace` / `reopenCarrierSpace` |
| `src/screens/shipper/ApproveCarrierScreen.jsx` | **DELETED** (orphan) |
| `src/navigation/AppStack.jsx` | Removed ApproveCarrier; restored CarrierVerification import |
| `src/services/commercial.js` | Removed suggest/counter exports; close/reopen used by UI |
| `src/services/carrierOffer.js` | Removed `submitCounterOffer` |
| `scripts/phase2-validation.mjs` | close/reopen exports; stack screens updated |
| `scripts/phase3-validation.mjs` | Same |
| `scripts/phase4-endpoint-audit.mjs` | close/reopen endpoints; removed suggest rows |
| `scripts/phase4-screen-audit.mjs` | ApproveCarrier → removed note |
| `scripts/phase5-validation.mjs` | Dropped ApproveCarrier requirement |

### Backend

| File | Change |
|------|--------|
| `routes/shipmentRoutes.js` | **FIX** — `const router = express.Router()` (startup crash) |
| `test/helpers/serverReachable.js` | **NEW** — health probe + wait |
| `test/helpers/config.js` | `integrationSuiteSkipReason()` |
| `scripts/run-all-tests.mjs` | **NEW** — preflight + `test/*.test.js` |
| `scripts/run-integration-tests.mjs` | **NEW** — health wait + full suite |
| `scripts/preflight-integration.mjs` | **NEW** |
| `package.json` | `test` → run-all-tests; `test:integration` added |
| HTTP test suites | Skip when `INTEGRATION_SERVER_READY=0` |
