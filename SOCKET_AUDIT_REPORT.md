# Socket & Realtime Audit Report

**Date:** 2026-06-17  
**Scope:** Mobile socket client, AppContext, capacity panels; web/backend reference

---

## Files audited

| Mobile | Web reference | Backend |
|--------|---------------|---------|
| `src/services/socket.js` | `transpak-frontend/src/services/socket.js` | `transpak-backend/sockets/index.js` |
| `src/context/AppContext.jsx` | `transpak-frontend/src/context/AppContext.jsx` | `services/realtimeHub.js` |
| `src/utils/realtimeSync.js` | `utils/realtimeDispatch.js` | |
| `src/utils/dispatchScope.js` | **Created** — type→scope map | |
| `src/hooks/useRefreshOnScope.js` | `notificationPipeline.js` | |
| `src/components/carrier/CarrierSpacePanels.jsx` | `SpaceRequestsPanel.jsx` | |

---

## Issues found

| ID | Severity | Issue |
|----|----------|-------|
| S1 | **Critical** | `onDispatch` used `evt.scope` object instead of `evt.type` → scoped refresh broken |
| S2 | High | Socket `disconnect()` did not `off()` handlers → orphan listeners on role-switch recreate |
| S3 | Medium | No `reconnectSyncInFlightRef` → overlapping reconnect sync possible |
| S4 | Medium | Mobile missing `space:join` for capacity request realtime |
| S5 | Medium | `registerRefreshHandler` Map overwrites per scope (last tab wins) — documented |
| S6 | Low | Full socket recreate on `activeRole` change (web keeps socket) — not changed (blast radius) |
| S7 | Device-only | `REALTIME_SOCKET` smoke = PARTIAL |

---

## Issues fixed

| ID | Fix |
|----|-----|
| S1 | `scopeFromDispatchEvent()` in `dispatchScope.js`; AppContext uses `evt.type` mapping |
| S2 | `registerHandler` + `handlers[]` cleanup in `disconnect()` |
| S3 | `reconnectSyncInFlightRef` guard in AppContext `onReconnect` |
| S4 | `SpaceRequestsPanel`: `space:join` on mount + `connect`; `useRefreshOnScope('space', load)` |
| — | Fixed `onReconnect` naming collision in `socket.js` (build blocker) |

---

## Remaining risks

| Risk | Status |
|------|--------|
| Role-switch full socket teardown | Documented; refresh via `emitRefreshScope('all')` compensates |
| Per-dispatch `refreshNotifications()` API load | Acceptable for MVP |
| Multi-tab scope handler overwrite | Mitigated by reconnect `all` refresh |
| Push notification on device | Device-only verification |

---

## Listener inventory (mobile)

| Event | Registered in | Cleaned up |
|-------|---------------|------------|
| `connect` | socket.js | Yes (disconnect) |
| `disconnect` | socket.js | Yes |
| `connect_error` | socket.js | Yes |
| `dispatch:event` | socket.js | Yes |
| `notification:new` | socket.js | Yes |
| `notifications:batch` | socket.js | Yes |
| `tracking:update` | socket.js | Yes |
| `reconnect` | socket.io | Yes |
| `connect` (space join) | CarrierSpacePanels | Yes (`off`) |

---

## Validation evidence

- `smoke:phase4` production: **23 PASS, 2 PARTIAL** (local health + REALTIME_SOCKET)
- `validate:phase4` endpoint audit: **44 PASS, 3 LOW_GAP**
