# TransPAK Device Test Template (D1–D8)

**Date:** 2026-06-18  
**Purpose:** Manual signoff required before **GO (SAFE)** promotion per Zero-Gap Production Audit.

**Instructions:** Run each test on a physical device or emulator with backend reachable. Record **PASS** or **FAIL**, attach screenshot or log snippet, and note build/commit.

**Environment:**

| Field | Value |
|-------|-------|
| Backend URL | |
| Web build SHA | |
| Mobile build / Expo channel | |
| Tester | |
| Date | |

---

## D1 — Login

| Step | Action | Expected |
|------|--------|----------|
| 1 | Open app / web login | Login form visible |
| 2 | Enter shipper credentials | |
| 3 | Submit | Redirect to dashboard; token stored |
| 4 | Log out and repeat with carrier | Carrier workspace loads |

**API:** `POST /api/auth/login`

| Result | PASS / FAIL |
|--------|-------------|
| Notes / logs | |
| Screenshot | |

---

## D2 — Registration + OTP

| Step | Action | Expected |
|------|--------|----------|
| 1 | Register new user (unique email) | 201 / verification prompt |
| 2 | Enter OTP from email/logs | Account verified |
| 3 | Login with new account | Success |

**API:** `POST /api/auth/register`, OTP verify endpoints

| Result | PASS / FAIL |
|--------|-------------|
| Notes / logs | |
| Screenshot | |

---

## D3 — Create load (shipper)

| Step | Action | Expected |
|------|--------|----------|
| 1 | Switch to shipper workspace | |
| 2 | Post Load — fill required fields | Validation passes |
| 3 | Submit | Load appears in My Loads / marketplace |
| 4 | Note load ID | |

**API:** `POST /api/loads/create`

| Result | PASS / FAIL |
|--------|-------------|
| Load ID | |
| Notes / logs | |

---

## D4 — Place bid (carrier)

| Step | Action | Expected |
|------|--------|----------|
| 1 | Switch to carrier workspace | |
| 2 | Open load from D3 | Details visible |
| 3 | Place bid with amount | Bid submitted |
| 4 | Confirm in My Bids | Status pending |

**API:** `POST /api/bids`

| Result | PASS / FAIL |
|--------|-------------|
| Bid ID | |
| Notes / logs | |

---

## D5 — Accept bid (shipper)

| Step | Action | Expected |
|------|--------|----------|
| 1 | Shipper: open bid management for load | Pending bid visible |
| 2 | Accept bid | Success toast / status update |
| 3 | Verify shipment created | Appears in Active Shipments |
| 4 | Confirm no counter-offer UI | Accept + Reject only |

**API:** `PUT /api/bids/:id/accept`

| Result | PASS / FAIL |
|--------|-------------|
| Shipment ID | |
| Notes / logs | |

---

## D6 — Tracking

| Step | Action | Expected |
|------|--------|----------|
| 1 | Open shipment tracking (both roles as applicable) | Map / timeline loads |
| 2 | Carrier advances status (if UI exposed) | Timeline updates |
| 3 | Verify socket join (optional: network tab) | Realtime updates without full refresh |

**API:** `GET /api/shipments/track/:ref`, socket tracking room

| Result | PASS / FAIL |
|--------|-------------|
| Notes / logs | |
| Screenshot | |

---

## D7 — Notifications

| Step | Action | Expected |
|------|--------|----------|
| 1 | Trigger notification (bid accept from D5) | Notification appears |
| 2 | Open notifications list | Unread count > 0 |
| 3 | Mark read / mark all read | Count decrements |
| 4 | Socket delivery (optional) | In-app update without refresh |

**API:** `GET /api/notifications`, `GET /api/notifications/unread-count`, PATCH read endpoints

| Result | PASS / FAIL |
|--------|-------------|
| Notes / logs | |

---

## D8 — Review prompt

| Step | Action | Expected |
|------|--------|----------|
| 1 | Complete shipment to delivered → closed (or use test shipment) | |
| 2 | Observe REVIEW_PROMPT (modal on web; mobile prompt if wired) | Review form appears |
| 3 | Submit review OR dismiss | Persisted; not shown again for same shipment |
| 4 | Verify one-review-per-shipment | Duplicate blocked |

**API:** `GET /api/reviews/pending`, `POST /api/reviews`, dismiss endpoint

| Result | PASS / FAIL |
|--------|-------------|
| Notes / logs | |
| Screenshot | |

---

## Bonus — Capacity close (post-audit fix)

| Step | Action | Expected |
|------|--------|----------|
| 1 | Carrier: post carrier space listing | Created |
| 2 | Close listing | Success (POST `/close`, not PATCH status) |
| 3 | Reopen if UI shows closed state | Success via POST `/reopen` |

| Result | PASS / FAIL |
|--------|-------------|
| Listing ID | |

---

## Summary signoff

| ID | Flow | Result |
|----|------|--------|
| D1 | Login | |
| D2 | Registration | |
| D3 | Create load | |
| D4 | Place bid | |
| D5 | Accept bid | |
| D6 | Tracking | |
| D7 | Notifications | |
| D8 | Review | |
| Bonus | Capacity close | |

**Overall:** PASS / FAIL  
**Signed by:** _______________ **Date:** _______________

Paste results into chat or append to `TEST_EVIDENCE_REPORT.md` for certification update.
