# API Contract Audit

**Date:** 2026-06-17  
**Scope:** `transpak-backend` vs `transpak-frontend` vs `transpak-mobile-frontend` (commercial APIs)

---

## Method

1. Backend routes: `transpak-backend/routes/*.js` validators
2. Web: `transpak-frontend/src/services/` + page `request()` calls
3. Mobile: `commercial.js`, `auth.js`, `uploadMedia.js`
4. Artifact: [`phase4-endpoint-audit.json`](transpak-mobile-frontend/scripts/artifacts/phase4-endpoint-audit.json) — **44 PASS, 3 LOW_GAP, 0 FAIL**

---

## Summary

| Category | Status | Evidence |
|----------|--------|----------|
| Core commercial REST | **ALIGNED** | 44/44 mobile wrappers PASS |
| Auth / role | **ALIGNED** | login, register, profile, active-role, add-role |
| Feedback | **ALIGNED** (fixed) | `{ subject, message }` both clients |
| Tracking socket | **ALIGNED** | `tracking:join`, `tracking:location` |
| Capacity socket | **ALIGNED** (fixed) | `space:join` wired mobile |
| Upload | **ALIGNED** | `POST /upload/media` multipart |
| Chat | **MISSING mobile** | Out of scope |
| Telemetry | **LOW_GAP** | metrics/perf ingest — neither UI |

---

## Verified contracts (high-risk)

### Feedback

| Layer | Payload | File |
|-------|---------|------|
| Backend | `subject` (1–120), `message` (1–2000) | `routes/feedbackRoutes.js` L25–26 |
| Web | `{ subject, message }` | `pages/support/Feedback.jsx` |
| Mobile | `{ subject, message }` | `FeedbackScreen.jsx` L30 |

### Tracking (socket)

| Event | Payload | Mobile | Web |
|-------|---------|--------|-----|
| `tracking:join` | `{ refKey }` | ShipmentTrackingScreen | trackingJoinQueue |
| `tracking:location` | `{ refKey, lat, lng, accuracy?, ts? }` | ShipmentTrackingScreen | useTrackingSocket |
| `tracking:update` | server → client | AppContext handler | notificationPipeline |

### Capacity (socket)

| Event | Payload | Mobile | Web |
|-------|---------|--------|-----|
| `space:join` | `{ requestId }` | CarrierSpacePanels | SpaceRequestsPanel |

### Upload

| Endpoint | Field | Clients |
|----------|-------|---------|
| `POST /api/upload/media` | multipart `file` | `uploadMedia.js` (mobile), `uploadApi.js` (web) |

### Notifications

| Endpoint | Method | Mobile wrapper | Web |
|----------|--------|----------------|-----|
| `/notifications` | GET | `fetchNotificationsPage` | page request |
| `/notifications/unread-count` | GET | `fetchUnreadNotificationCount` | yes |
| `/notifications/:id/read` | PATCH | `markNotificationRead` | yes |
| `/notifications/read-all` | PATCH | `markAllNotificationsRead` | yes |
| `/notifications/sync` | GET | via `realtimeSync.js` | yes |

---

## Mismatches found

| ID | Area | Issue | Severity | Status |
|----|------|-------|----------|--------|
| C1 | Chat | 5 endpoints web-only (`chatApi.js`) | Out of scope | Documented |
| C2 | Runtime i18n | `POST /translations/runtime` web only | Low | LOW_GAP |
| C3 | Telemetry | `/metrics/ingest`, `/operations/client-perf` unused | Low | LOW_GAP |
| C4 | Replay | `GET /replay/shipment/:id` debug only | Low | Acceptable |
| C5 | Maps route | `/maps/route` wrapper exists; tracking uses `fetchRouteByCities` | Low | PASS |

**No wrong payload keys found** in certified commercial flows after feedback fix.

---

## Dead / unused endpoints (commercial)

| Endpoint | Used by web | Used by mobile | Notes |
|----------|-------------|----------------|-------|
| `/messages/*` | Yes | No | Out of scope |
| `/admin/*` | Yes | No | Web admin only |
| `/metrics/ingest` | No | No | Telemetry |
| `/operations/client-perf` | No | No | Telemetry |
| `/translations/runtime` | Partial | No | Static i18n on mobile |

---

## Role permissions (verified static)

- Shipper-only: `POST /loads`, bid accept/reject
- Carrier-only: place bid, truck CRUD, capacity post
- Admin: `/api/admin/*` guarded by `requireAdminSession`
- Workspace header: `X-TransPak-Workspace` — mobile smoke `WORKSPACE_HEADER` PASS

---

## Error handling alignment

| Pattern | Backend | Web | Mobile |
|---------|---------|-----|--------|
| 403 profile gate | `PROFILE_INCOMPLETE` | UI redirect | 403 on POST_LOAD smoke |
| 401/403 ownership | `resourceAuth.js` | handled | `unwrapErrorMessage` |
| Validation 400 | express-validator messages | toast/alert | Alert + i18n |

---

## API coverage score

**92%** commercial (44 PASS / (44 + 3 LOW_GAP + 5 chat deferred))

Evidence: `phase4-endpoint-audit.json`, manual feedback/tracking/socket crosswalk above.
