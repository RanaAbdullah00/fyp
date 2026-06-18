# API Changes Report

**Date:** 2026-06-18

## New endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/carrier-space/:id/close` | Owner closes listing (validated transitions) |
| POST | `/api/carrier-space/:id/reopen` | Owner reopens closed/expired listing |
| POST | `/api/carrier-space/:id/expire` | Owner/admin expires listing + pending requests |

## Changed behavior

| Endpoint | Change |
|----------|--------|
| PATCH `/api/carrier-space/:id` | **Field edits only** — `status` no longer accepted in body |
| PUT `/api/carrier-space/requests/:id/in-transit` | **410** — use shipment status route |
| PUT `/api/carrier-space/requests/:id/complete` | **410** — use shipment status route |
| PUT `/api/bids/:id/suggest` | **410** — counter-offer retired |
| PUT `/api/bids/:id/suggest-carrier` | **410** |
| PUT `/api/bids/:id/accept-suggestion` | **410** |
| PUT `/api/bids/:id/reject-suggestion` | **410** |
| PUT `/api/shipments/:id/status` | Syncs load + capacity listing; `REVIEW_PROMPT` on closed |
| GET `/api/shipments/active` | Includes **delivered** (excludes only **closed**) |

## Client wiring (2026-06-18)

| Client | Close | Reopen |
|--------|-------|--------|
| Web | `carrierSpace.js` → POST `/carrier-space/:id/close` | POST `/reopen` |
| Mobile | `commercial.js` → `CarrierSpacePanels.jsx` | Same |

**Do not** PATCH `{ status: 'closed' }` — rejected by `rejectForbiddenBodyFields.js`.

- Auth, OTP, notifications, feedback `{ subject, message }`, Cloudinary upload paths preserved.
- Accept/Reject bid flows unchanged.
