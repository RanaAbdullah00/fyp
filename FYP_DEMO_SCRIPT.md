# FYP Demo Walkthrough Script

**Date:** 2026-06-17  
**Test accounts:** `transpak.phase1.shipper@example.com` / `transpak.phase1.carrier@example.com` (password `11223344`)  
**Production API:** `https://transpak-backend-1.onrender.com`

---

## Prerequisites

- Shipper and carrier accounts with **complete profiles** (required for load post / bid accept)
- Carrier has at least one **approved** truck (admin approval via web `/admin` if pending)
- Mobile app pointed at production (`EXPO_PUBLIC_API_BASE_URL`)
- Physical device recommended for steps 11 (tracking GPS)

---

## Demo flow

### 1. Registration

| | |
|---|---|
| **Role** | New user |
| **Web** | `/register` |
| **Mobile** | `RegisterScreen` |
| **Steps** | Enter name, email, password, select shipper or carrier, submit |
| **Expected** | Success message; OTP email sent |
| **Evidence** | Manual / Brevo inbox |

### 2. OTP verification

| | |
|---|---|
| **Role** | New user |
| **Web** | `/verify-email` |
| **Mobile** | `VerifyOtpScreen` |
| **Steps** | Enter 6-digit code from email |
| **Expected** | Session created; navigate to app |
| **Evidence** | Device — email delivery |

### 3. Login

| | |
|---|---|
| **Role** | Shipper or carrier |
| **Web** | `/login` |
| **Mobile** | `LoginScreen` |
| **Steps** | Email, password, role chip, Sign in |
| **Expected** | Dashboard loads |
| **Evidence** | smoke `AUTH_LOGIN_SHIPPER` / `AUTH_LOGIN_CARRIER` |

### 4. Add role (dual-role user)

| | |
|---|---|
| **Role** | User with single role |
| **Web** | Profile → Add role |
| **Mobile** | `ProfileScreen` → Add shipper/carrier role |
| **Expected** | Second role on account |
| **Evidence** | phase5 device-code G |

### 5. Switch role

| | |
|---|---|
| **Role** | Dual-role user |
| **Web** | Header role switch |
| **Mobile** | `MobileHeader` role toggle |
| **Expected** | Workspace changes; tabs refresh |
| **Evidence** | smoke `ROLE_SWITCH` |

### 6. Post load

| | |
|---|---|
| **Role** | Shipper |
| **Web** | `/loads/post` |
| **Mobile** | `PostLoadScreen` |
| **Pre** | Profile complete |
| **Steps** | Origin, destination, weight, dates, vehicle type, submit |
| **Expected** | Load appears in My loads / marketplace |
| **Evidence** | smoke `POST_LOAD` (403 if profile incomplete — expected gate) |

### 7. Browse loads

| | |
|---|---|
| **Role** | Carrier |
| **Web** | `/loads/manage?tab=marketplace` |
| **Mobile** | `LoadsHubScreen` → Marketplace tab |
| **Expected** | Open loads list with filters |
| **Evidence** | smoke `MARKETPLACE_LOADS` |

### 8. Place bid

| | |
|---|---|
| **Role** | Carrier |
| **Web** | Load details → Place bid |
| **Mobile** | `LoadDetailsScreen` → `PlaceBidScreen` |
| **Expected** | Bid created; shipper notified |
| **Evidence** | static bid wrappers |

### 9. Accept bid

| | |
|---|---|
| **Role** | Shipper |
| **Web** | `/bids` → Accept |
| **Mobile** | `ShipperBidsScreen` → Accept |
| **Expected** | Shipment created; load assigned |
| **Evidence** | phase5 E bid lifecycle |

### 10. Create shipment (implicit)

| | |
|---|---|
| **Role** | System |
| **Note** | Shipment auto-created on bid accept |
| **Expected** | Appears in Active shipments |
| **Evidence** | smoke `SHIPMENTS_ACTIVE` |

### 11. Track shipment

| | |
|---|---|
| **Role** | Shipper (view) / Carrier (GPS) |
| **Web** | `/shipments/tracking/:refKey` |
| **Mobile** | `ShipmentTrackingScreen` |
| **Steps** | Carrier: select shipment, grant location; Shipper: watch map |
| **Expected** | Map with origin/destination/live marker; socket updates |
| **Evidence** | **Device required** — `DEVICE_READINESS_REPORT` D2–D4 |

### 12. Register truck

| | |
|---|---|
| **Role** | Carrier |
| **Web** | `/carrier/truck-details` |
| **Mobile** | `TruckDetailsScreen` tab |
| **Steps** | Add plate, type, upload card image |
| **Expected** | Truck `pending` until admin approves (web admin) |
| **Evidence** | smoke `TRUCKS_LIST` |

### 13. Post capacity

| | |
|---|---|
| **Role** | Carrier |
| **Web** | `/carrier/space/post` |
| **Mobile** | `PostCarrierSpaceScreen` |
| **Expected** | Listing in My capacity |
| **Evidence** | smoke `CARRIER_SPACE_POST` |

### 14. Capacity request

| | |
|---|---|
| **Role** | Shipper requests; Carrier accepts |
| **Web** | Capacity hub panels |
| **Mobile** | `LoadsHubScreen` capacity tab + `SpaceRequestsPanel` |
| **Expected** | Request sent → accepted → lifecycle updates |
| **Evidence** | smoke `CARRIER_SPACE_REQUEST`, `CARRIER_SPACE_LIFECYCLE` |

### 15. Review user

| | |
|---|---|
| **Role** | Shipper or carrier post-delivery |
| **Web** | Review prompt |
| **Mobile** | `ReviewPromptHost` modal |
| **Expected** | Rating 1–5 + comment saved |
| **Evidence** | smoke `REVIEWS_DISMISSED` |

### 16. Notification flow

| | |
|---|---|
| **Role** | Either |
| **Web** | `/notifications` |
| **Mobile** | `NotificationsScreen` + header badge |
| **Steps** | Trigger bid/load event; open notifications; mark read |
| **Expected** | Badge decrements; list updates |
| **Evidence** | smoke `NOTIFICATIONS_LIST`, `NOTIFICATIONS_UNREAD` |

### 17. Profile management

| | |
|---|---|
| **Role** | Either |
| **Web** | `/profile` |
| **Mobile** | `ProfileScreen` |
| **Steps** | Edit fields, save, optional avatar upload |
| **Expected** | Profile persisted |
| **Evidence** | smoke `PROFILE_GET`, `PROFILE_UPDATE` |

---

## Demo tips

- Use **two devices/browsers** (shipper + carrier) for live bid/tracking demo
- Complete shipper profile before posting loads (avoids 403)
- Approve carrier trucks via **web admin** before fleet-dependent flows
- For FYP presentation, pre-seed an active shipment to skip bid wait time

---

## Out of scope for demo

- Messages/chat
- Mobile admin moderation
- Causal replay debug tool
