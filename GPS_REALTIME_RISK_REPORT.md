# TRANSPAK GPS & Realtime Risk Report

**Date:** 2026-06-17  
**Scope:** Mobile realtime stack vs backend Socket.IO contract

---

## Architecture

```
AppContext.jsx          → socket connect on auth
  └─ socket.js          → JWT auth, event handlers
       ├─ notification:new → unread badge + list
       ├─ tracking:update  → registerTrackingHandler callbacks
       └─ dispatch:event   → realtimeSync → useRefreshOnScope

ShipmentTrackingScreen.jsx
  ├─ tracking:join on shipment select
  ├─ expo-location watchPositionAsync → tracking:location emit
  └─ LazyMapTracker → MapTracker (react-native-maps)

Backend: transpak-backend/sockets/index.js
  ├─ tracking:join / tracking:location / tracking:update
  └─ workspace rooms for dispatch:event
```

---

## Static code audit results

Source: `transpak-mobile-frontend/scripts/artifacts/phase5-device-code-audit.json`

| ID | Workflow | Verdict | Detail |
|----|----------|---------|--------|
| A | Realtime notifications | **PASS** | `notification:new` → `addNotification` |
| B | tracking:update | **PASS** | Handler in `ShipmentTrackingScreen` |
| C | dispatch:event | **PASS** | `useRefreshOnScope` refresh scopes |
| D | GPS route updates | **PARTIAL** | Socket wired; REST `updateShipmentLocation` unused as fallback |
| E | Bid accept/reject | **PASS** | LoadDetails + ShipperBids |
| F | Register → OTP | **PASS** | Auth flow wired |
| G | Add-role | **PASS** | Profile + auth API |
| H | Role switch hardening | **PASS** | Token refresh + scope refresh |

Smoke: `REALTIME_SOCKET` = **PARTIAL** (device required)

---

## Risk register

### R1 — GPS permission denied (High on device, Low crash)

- **File:** `ShipmentTrackingScreen.jsx`
- **Behavior:** `requestForegroundPermissionsAsync`; shows localized alert if denied
- **Impact:** Carrier cannot emit live location
- **Mitigation:** User must grant location in OS settings; copy explains requirement

### R2 — Emulator vs physical device (High)

- **Risk:** GPS and socket background behavior unreliable on emulator
- **Impact:** False negatives in QA
- **Mitigation:** Physical device signoff required before SAFE deploy

### R3 — GPS watch lifecycle (Medium — mitigated)

- **Risk:** Multiple watches if user switches shipments rapidly
- **Mitigation applied:** `stopGps()` before new watch; cleanup on screen blur via `useFocusEffect`

### R4 — Socket reconnect without re-join (Medium)

- **Risk:** After disconnect, tracking room may not re-join automatically
- **Files:** `socket.js`, `AppContext.jsx`
- **Web comparison:** Web has `trackingJoinQueue.js` — mobile uses simpler join on `selected` change
- **Mitigation:** User can re-select shipment or pull-to-refresh; `operations/sync/events` exists for catch-up

### R5 — REST GPS fallback unused (Low)

- **API:** `PUT /api/shipments/:id/location`
- **Wrapper:** `updateShipmentLocation` in `commercial.js`
- **Screen:** Not called from `ShipmentTrackingScreen`
- **Impact:** If socket fails, no HTTP fallback for GPS
- **Recommendation:** Optional future enhancement; not required for current certification

### R6 — Missing space:join (Medium for capacity UX)

- **Risk:** Capacity request status updates may lag until manual refresh
- **Web:** Joins `space:{requestId}` rooms
- **Mobile:** Relies on `dispatch:event` scope refresh only
- **Impact:** Stale capacity request lists until focus/refresh

### R7 — Map performance (Low — mitigated)

- **Mitigation:** `LazyMapTracker` defers `react-native-maps` import until tracking screen visible
- **Risk:** Large route polylines on low-end devices

### R8 — Background location (High limitation)

- **Current:** Foreground permission only (`requestForegroundPermissionsAsync`)
- **Impact:** GPS stops when app backgrounded
- **Note:** Matches typical MVP; background tracking would need additional permissions and policy review

---

## Device test script (required for SAFE)

1. Carrier account with active shipment in `booked` or `intransit` status
2. Open **Shipment tracking** on carrier device
3. Select shipment → grant location permission
4. Verify map shows origin, destination, and live marker
5. Move device (or simulate location) → confirm marker updates within ~15s
6. Shipper account: open same shipment tracking → confirm `tracking:update` received
7. Background app briefly → confirm reconnect or manual refresh recovers state
8. Post capacity request as shipper → carrier accepts → verify both see updated status (may require pull-to-refresh)

---

## Backend contract (unchanged)

| Event | Direction | Payload |
|-------|-----------|---------|
| `tracking:join` | Client → server | `{ refKey }` |
| `tracking:location` | Client → server | `{ refKey, lat, lng, accuracy, ts }` |
| `tracking:update` | Server → client | GPS + tracking snapshot |
| `dispatch:event` | Server → client | Entity state changes |
| `notification:new` | Server → client | Notification row |

No backend changes made in this certification pass.

---

## Verdict

| Category | Status |
|----------|--------|
| Code wiring | **PASS** (static) |
| Runtime GPS/map | **DEVICE-ONLY** |
| Realtime notifications | **DEVICE-ONLY** |
| Capacity realtime | **PARTIAL** (no space:join) |

**Recommendation:** Ship as **CONDITIONAL** until device test script above is executed and signed off.
