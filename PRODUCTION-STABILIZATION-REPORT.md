# TransPak Production Stabilization Report

**Date:** 2026-06-13  
**Scope:** P0–P3 stabilization plan (25 issue groups)  
**Regression gates:** Phase 3 rating batch, Phase 7 enterprise tracing, RBAC unchanged

## Summary

Production pain was traced to four systemic gaps: real-time fan-out, blocking `notifyUser` on write paths, stale client cache, and partial UI payloads/errors. This pass closes those gaps without payment features or destructive schema changes.

## Phase P0 — Real-time synchronization

| Change | Files |
|--------|-------|
| Losing carriers notified on bid accept (`BID_REJECTED` + `LOAD_ACCEPTED`) | `bidRealtime.js`, `bidRoutes.js` |
| Belt-and-suspenders: reject bids when `accepted_bid_id` set | `matchingEngine.js` |
| `BID_ACCEPTED` / `LOAD_ACCEPTED` refresh `loads`, `bids`, `shipments` | `notificationPipeline.js`, `realtimeDispatch.js` |
| `filterOpenLoads()` wired after fetch; `tp:load-booked` optimistic removal | `AvailableLoads.jsx`, `CarrierDashboard.jsx` |
| Shipment status PUT emits `SHIPMENT_STATUS` contract dispatch | `shipmentRoutes.js` |
| Dashboards listen to `tp:shipment-status-updated` | `CarrierDashboard.jsx`, `ShipperDashboard.jsx`, `ActiveShipmentsList.jsx`, `useDashboardMetrics.js` |
| Fleet approve/reject/suspend realtime to carrier | `adminFleetController.js` |
| Capacity listing realtime on POST | `carrierSpaceRoutes.js` |

## Phase P0 — Write-path performance

| Change | Files |
|--------|-------|
| `void notifyUser()` on reviews, carrier-space, space booking | `reviewRoutes.js`, `carrierSpaceRoutes.js`, `spaceBookingRoutes.js` |
| Non-blocking shipment status notifications | `shipmentRoutes.js` |
| `GET /shipments/history` alias (fixes 404) | `shipmentRoutes.js` |
| Idempotency on load/capacity POST | `loadRoutes.js`, `carrierSpaceRoutes.js`, `spaceBookingRoutes.js` |
| Duplicate load fingerprint (60s window) | `loadRoutes.js` |
| `closeExpiredCapacityListings()` off hot GET path | `carrierSpaceRoutes.js` |

## Phase P1 — Timeline, tracking, errors

| Change | Files |
|--------|-------|
| `dedupeTimelineEvents()` + monotonic merge | `shipmentStatusOptimistic.js` |
| Socket status overlay populated on emit | `shipmentStatusOptimistic.js` |
| Tracking payload: carrier name, phone, plate, ETA | `trackingPayload.js` |
| Tracking page maps live fields (not em-dash) | `ShipmentTracking.jsx` |
| Error code registry extensions | `userErrors.js` |

## Phase P1 — Fleet rules

| Change | Files |
|--------|-------|
| Block carrier DELETE on approved trucks | `truckController.js` |
| Hide delete button for approved trucks in UI | `TruckDetails.jsx` |
| Admin fleet approval socket dispatch | `adminFleetController.js` |

## Phase P2 — Dedupe, bids, reviews

| Change | Files |
|--------|-------|
| Load POST idempotency + duplicate guard | `loadRoutes.js` |
| Bid management tabs (Open / Counter / Active / History) | `BidManagement.jsx` |
| Review dismiss API + migration 029 | `reviewRoutes.js`, `029_review_prompt_dismissed.sql` |
| Server-side skip on “Skip for now” | `reviewDismissStore.js`, `ReviewPromptHost.jsx` |

## Phase P3 — Dashboard & profile

| Change | Files |
|--------|-------|
| Removed duplicate LoadList blocks; CTA to Loads Hub | `CarrierDashboard.jsx`, `ShipperDashboard.jsx` |
| Profile photo upload button + preview UX | `ProfileEditor.jsx` |

## Validation matrix

Run locally before deploy:

```bash
cd transpak-backend && npm test
cd transpak-backend && npm run test:phase7-enterprise
cd transpak-frontend && npm run build
node scripts/release-gate-probe.mjs
```

Static stabilization gate:

```bash
cd transpak-backend && node --test test/production-stabilization.static.test.js
```

## Migrations

- **029_review_prompt_dismissed.sql** — additive `users.review_prompt_dismissed JSONB`

Apply with `npm run db:migrate` in `transpak-backend`.

## Known follow-ups (non-blocking)

- `MyBids.jsx` tab structure mirrors `BidManagement.jsx` pattern (carrier-side tabs can be added in a follow-up PR).
- Live bundle verify against production URLs after deploy.
- Index additions (`notifications`, `ratings`) if query profiling shows need.

## Invariants preserved

- Phase 3 `/reviews/summary` batch path untouched
- Tracking coordinator (300ms flush, rAF, `activeSource`) unchanged
- Phase 7 causal/tracing schema additive only

---

## Pre-deploy audit remediation (2026-06-13)

| Blocker | Fix |
|---------|-----|
| Space request ON CONFLICT rewinds active contracts | Replaced upsert with status guard + `409 SPACE_REQUEST_LOCKED` in `spaceBookingRoutes.js` |
| Review dismiss not enforced server-side | `GET /reviews/pending` filters `review_prompt_dismissed`; added `GET /reviews/dismissed`; client hydrates via `hydrateReviewDismissedFromServer` |
| Capacity DELETE bypasses active agreement guard | `DELETE /carrier-space/:id` returns `409 LISTING_ACTIVE` when active/in_transit requests exist |
| Release probe schema mismatch | Probe accepts schema `028` or `029`; adds `/api/shipments/history` route check |
| Tracking phone not shown | `carrierPhone` mapped in `ShipmentTracking.jsx` + `ShipmentCard.jsx` |

### Deploy checklist (required before production READY)

1. Push backend + frontend from current branch (Render auto-deploy + Cloudflare Pages)
2. Render start command runs `npm run db:migrate` (applies through **029**)
3. Verify live: `GET /api/shipments/history` → **401** or **200** (not 404)
4. Verify live: health schema version **028+**
5. Run `node scripts/release-gate-probe.mjs` → all checks pass
6. Run dual-carrier bid accept + review POST timing smoke on production

**Note:** Production was on schema **027** and bundle `45q78JT5` at audit time — stabilization + audit fixes require a new deploy.
