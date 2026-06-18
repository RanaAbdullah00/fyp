# Mobile Impact Report

**Date:** 2026-06-18 (Zero-Gap Production Audit)

## Critical fix — capacity close

| Before | After |
|--------|-------|
| `CarrierSpacePanels` PATCH status → **400** | `closeCarrierSpace` / `reopenCarrierSpace` POST |

## Orphan cleanup

- `ApproveCarrierScreen.jsx` **deleted**; removed from `AppStack.jsx`

## Fixes

| Area | Impact |
|------|--------|
| LoadsHub marketplace | Counter input/button **removed** — Accept + Pass only |
| Load details | Bids shown only when load **open**; BidTimeline replaced with StatusTimeline for booked+ |
| BidCard | Counter/suggest actions **removed**; legacy suggested amount read-only |
| Shipper/Carrier bid screens | Open/Active/History tabs; Accept/Reject only |
| Profile | i18n keys for address/company/fullName/phone/cnic/save via `tOr` |
| Capacity API | `closeCarrierSpace` / `reopenCarrierSpace` helpers in `commercial.js` |

## Validation (2026-06-18)

```
validate:phase4 → OK (40 screens, 44 endpoints, 0 FAIL)
validate:phase5 → OK (7 device-code PASS, 1 PARTIAL)
smoke:phase4 → PASS=25 PARTIAL=3 FAIL=0
```

## Parity gaps (unchanged)

- Mobile chat/messages — out of scope (web only)
- Physical device GPS/socket — manual checklist D1–D8 still required

## API alignment

Mobile `commercial.js` exposes capacity lifecycle close/reopen POST wrappers matching backend routes.
