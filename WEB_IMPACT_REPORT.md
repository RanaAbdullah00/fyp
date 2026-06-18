# Web Impact Report

**Date:** 2026-06-18 (Zero-Gap Production Audit)

## Critical fix — capacity close

| Before | After |
|--------|-------|
| `MySpaceListings` PATCH `{ status: 'closed' }` → **400** | `carrierSpace.js` POST `/carrier-space/:id/close` |
| No reopen UI | `CarrierSpaceCard` reopen when `status === 'closed'` |

## UX changes (cumulative)

| Area | Change |
|------|--------|
| Counter offers | **Removed** from AvailableLoads, CarrierDashboard, CarrierLoadActions, MyBids, BidCard — Accept/Reject only; legacy **Suggested** badge read-only |
| Approve Carrier | Orphan page **deleted**; route already removed |
| `/loads/accepted` | **Redirects** to `/shipments/active` |
| Shipment timeline | `mergeShipmentTimelineEvents` filters to **4 steps** (booked → delivered); no closed row |
| Capacity cards | **`tp-space-card`** blue/green theme tokens in `dashboard.css` (+ dark mode) |
| Review prompt | `REVIEW_PROMPT` socket → `emitReviewPromptSync` → `ReviewPromptHost` fetch/modal |
| Profile i18n | Added `profile.address`, `profile.company`, `profile.fullName`, etc.; `notifications.markAllRead` alias |
| Shipper dashboard | **Delivered Value** KPI kept — sourced from `/loads/mine` closed rows (not operations snapshot) |

## Build evidence (2026-06-18)

```
npm run build → exit 0 — BUILD OK - DEPLOY SAFE
```

## Orphan cleanup

- `AcceptedLoads.jsx` **deleted** (route redirects to `/shipments/active`)
- Dead `submitCounterOffer` removed from `carrierLoadOffer.js`

## Breaking UI removals

- `/bids/approve` route and `ApproveCarrier.jsx` removed
- Carrier counter/suggest actions removed from marketplace surfaces
