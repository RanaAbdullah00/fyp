# Device Readiness Report

**Date:** 2026-06-17  
**Platform:** `transpak-mobile-frontend` (Expo SDK 54)

Consolidates [`GPS_AUDIT_REPORT.md`](GPS_AUDIT_REPORT.md) and [`SOCKET_AUDIT_REPORT.md`](SOCKET_AUDIT_REPORT.md).

---

## Component readiness

| Area | Files | Code status | Device verified |
|------|-------|-------------|-----------------|
| GPS watch | `ShipmentTrackingScreen.jsx` | PASS — cleanup, status gate, authoritative refKey | **NO** |
| Map render | `MapTracker.jsx`, `LazyMapTracker.jsx` | PASS — implemented, defensive polyline | **NO** |
| Socket connect | `socket.js`, `AppContext.jsx` | PASS — listener cleanup, dispatch scope | **NO** |
| Tracking rooms | `tracking:join` + reconnect re-join | PASS | **NO** |
| Capacity rooms | `space:join` in `CarrierSpacePanels.jsx` | PASS | **NO** |
| Notifications | HTTP + socket `notification:new` | PASS static | **NO** push |
| Camera/gallery | `ProfileScreen`, `TruckDetailsScreen` | Wired (`expo-image-picker`) | **NO** |
| Permissions | `expo-location` foreground | PASS — alert on deny | **NO** |

---

## Cleanup & leak audit

| Check | Result | Evidence |
|-------|--------|----------|
| GPS watch stopped on blur | PASS | `useFocusEffect` return `stopGps()` |
| GPS watch stopped on unmount | PASS | `useEffect` cleanup |
| GPS watch stopped on shipment change | PASS | `selected.id` effect |
| Socket listeners removed on disconnect | PASS | `socket.js` handlers[] + `off()` |
| Tracking handler unsubscribe | PASS | `registerTrackingHandler` cleanup |
| Space join connect listener | PASS | `socket.off('connect')` on unmount |
| Lazy map import race | PASS | `mounted` flag + error EmptyState |
| Reconnect sync storm | PASS | `reconnectSyncInFlightRef` |

---

## Permission flows

| Permission | Request point | Fallback |
|------------|---------------|----------|
| Location (foreground) | `startGps()` carrier tap | Alert + i18n message |
| Photo library | Profile avatar, truck card | Silent cancel on dismiss |
| Notifications | None (in-app only) | HTTP poll on reconnect |

**Limitation:** No background GPS — tracking stops when app backgrounded (documented).

---

## Offline / retry

| Scenario | Behavior |
|----------|----------|
| Socket disconnect | Auto-reconnect (max 3), `workspace:join`, sync on reconnect |
| GPS while socket down | Locations dropped (`if socket?.connected`) — no REST fallback |
| API errors | `unwrapErrorMessage` + EmptyState terminal states |
| Map load failure | EmptyState in LazyMapTracker |

---

## Device test checklist (manual signoff)

- [ ] **D1** Register → OTP → login on physical device
- [ ] **D2** Carrier grants location → map shows markers
- [ ] **D3** Walk/drive → shipper sees marker move within ~15s
- [ ] **D4** Socket reconnect after airplane mode → tracking resumes
- [ ] **D5** Notification received while app open
- [ ] **D6** Profile photo upload via gallery
- [ ] **D7** Truck card image upload
- [ ] **D8** Capacity request lifecycle with realtime refresh

---

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Emulator GPS unreliable | High | Require physical device |
| No REST GPS fallback | Low | Documented; socket primary |
| Foreground-only GPS | Medium | Expected for MVP |
| Push notifications not FCM | Medium | In-app socket only |

---

## Device readiness score

| Layer | Score |
|-------|-------|
| Code wiring | **94%** (phase5: 7 PASS, 1 PARTIAL REST fallback) |
| Runtime proof | **0%** (no device session in CI) |
| **Composite** | **CONDITIONAL** — code ready, device signoff pending |
