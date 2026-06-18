# GPS Tracking Audit Report

**Date:** 2026-06-17  
**Scope:** `transpak-mobile-frontend` shipment tracking + map rendering

---

## Files audited

| File | Role |
|------|------|
| `src/screens/shared/ShipmentTrackingScreen.jsx` | GPS watch, socket join/emit, shipment selection |
| `src/components/LazyMapTracker.jsx` | Deferred map load |
| `src/components/MapTracker.jsx` | **Created** — react-native-maps markers + polyline |
| `src/services/commercial.js` | `fetchShipmentTrack`, `fetchRouteByCities` |
| `src/utils/shipmentStatus.js` | `getAuthoritativeTrackRef` |
| `src/services/socket.js` | `tracking:update` relay |
| Web reference: `transpak-frontend/src/components/shipment/TrackingMap.jsx` | Parity reference |

---

## Flow

```
ShipmentTrackingScreen
  ├─ tracking:join (authoritative refKey)
  ├─ registerTrackingHandler → setLive
  ├─ watchPositionAsync (carrier, booked/pickedup/intransit only)
  ├─ tracking:location emit
  └─ LazyMapTracker → MapTracker (MapView, Marker, Polyline)
```

---

## Issues found

| ID | Severity | Issue |
|----|----------|-------|
| G1 | **Critical** | `MapTracker.jsx` missing — dynamic import failed at runtime |
| G2 | High | Socket `refKey` inconsistent with `getAuthoritativeTrackRef` |
| G3 | High | No `tracking:join` re-emit after socket reconnect |
| G4 | Medium | GPS watch not stopped on `selected` change |
| G5 | Medium | `startGps` ran for all statuses; backend only accepts booked/pickedup/intransit |
| G6 | Medium | LazyMapTracker infinite spinner on import failure |
| G7 | Low | REST `updateShipmentLocation` unused (phase5 PARTIAL — documented) |
| G8 | Device-only | Foreground GPS only; no background tracking |

---

## Issues fixed

| ID | Fix |
|----|-----|
| G1 | Implemented `MapTracker.jsx` with defensive coord parsing, polyline guard, empty-state |
| G2 | `resolveTrackRef()` uses `getAuthoritativeTrackRef` for join/emit/handler |
| G3 | Re-join on `socketConnected` flip + `joinTracking()` helper |
| G4 | `useEffect` stops GPS when `selected.id` changes |
| G5 | `isGpsEligible()` gates carrier GPS to active transit statuses |
| G6 | LazyMapTracker shows EmptyState on import error |

---

## Remaining (device-only)

- [ ] Physical device: permission grant/deny UX
- [ ] Carrier movement → shipper marker update within ~15s
- [ ] Background/foreground GPS throttling behavior
- [ ] Deep-link from `ShipmentsActiveScreen` auto-starts GPS (carrier must tap shipment — intentional tap-to-share)
- [ ] REST GPS fallback not implemented (low priority)

---

## Risk register

| Risk | Mitigation |
|------|------------|
| Permission denied | Alert + i18n message (existing) |
| Emulator GPS unreliable | Document device-only |
| Stale watch on rapid switch | `stopGps` before new watch + selected change cleanup |
| Invalid polyline coords | `normalizeRoute` filters non-finite points |
| Socket disconnect during emit | Silent drop (no REST fallback) |

---

## Validation evidence

- `validate:phase5` device-code audit: **7 PASS, 1 PARTIAL** (REST fallback unused)
- `npx expo export --platform android`: **PASS** (1100 modules, includes MapTracker)
