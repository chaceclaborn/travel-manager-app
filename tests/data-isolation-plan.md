# Data Isolation Test Plan — Travel Manager

> Status: Ready to automate once auth is configured for test users
> Last updated: 2026-02-25

## Overview

All Travel Manager data is scoped by `userId`. Every service function and API route
filters queries with the authenticated user's ID. These tests verify that user A's
data is never accessible to user B.

---

## Test Setup Requirements

- Two test user accounts with distinct Firebase UIDs (e.g., `test-user-a`, `test-user-b`)
- Seeded data: user-a owns trips, vendors, clients, attachments; user-b has separate data
- Auth tokens for both users (Firebase ID tokens or a test bypass)

---

## Test Cases

### TC-1: getTrips isolation

**Function:** `getTrips(userId)`
**Steps:**
1. Create a trip with `userId = "user-a"`
2. Call `getTrips("user-b")`
**Expected:** user-a's trip is NOT in the results
**API equivalent:** `GET /api/travelmanager/trips` with user-b's auth token

### TC-2: getTripById isolation

**Function:** `getTripById(tripId, userId)`
**Steps:**
1. Create a trip with `userId = "user-a"`, note the `tripId`
2. Call `getTripById(tripId, "user-b")`
**Expected:** Returns `null`
**API equivalent:** `GET /api/travelmanager/trips/{id}` with user-b's auth token returns 404

### TC-3: getDashboardStats isolation

**Function:** `getDashboardStats(userId)`
**Steps:**
1. Create 3 trips for user-a, 1 trip for user-b
2. Call `getDashboardStats("user-a")`
3. Call `getDashboardStats("user-b")`
**Expected:** user-a sees `totalTrips: 3`, user-b sees `totalTrips: 1`
**API equivalent:** `GET /api/travelmanager/dashboard` with each user's token

### TC-4: searchAll isolation

**Function:** `searchAll(query, userId)`
**Steps:**
1. Create a trip titled "Paris Vacation" for user-a
2. Call `searchAll("Paris", "user-b")`
**Expected:** Returns `{ trips: [], vendors: [], clients: [] }` — no results for user-b
**API equivalent:** `GET /api/travelmanager/search?q=Paris` with user-b's token

### TC-5: verifyTripOwnership rejects wrong user

**Function:** `verifyTripOwnership(tripId, userId)` (internal, called by update/delete)
**Steps:**
1. Create a trip for user-a, note `tripId`
2. Call `updateTrip(tripId, { title: "Hacked" }, "user-b")`
**Expected:** Throws `"Trip not found"` error
**API equivalent:** `PUT /api/travelmanager/trips/{id}` with user-b's token returns 500/404

### TC-6: getVendors isolation

**Function:** `getVendors(userId)`
**Steps:**
1. Create a vendor with `userId = "user-a"`
2. Call `getVendors("user-b")`
**Expected:** user-a's vendor is NOT in the results
**API equivalent:** `GET /api/travelmanager/vendors` with user-b's token

### TC-7: getClients isolation

**Function:** `getClients(userId)`
**Steps:**
1. Create a client with `userId = "user-a"`
2. Call `getClients("user-b")`
**Expected:** user-a's client is NOT in the results
**API equivalent:** `GET /api/travelmanager/clients` with user-b's token

### TC-8: linkVendorToTrip cross-user prevention (CRIT-3)

**Function:** `linkVendorToTrip(tripId, vendorId, userId)`
**Steps:**
1. Create a vendor for user-a, note `vendorId`
2. Create a trip for user-b, note `tripId`
3. Call `linkVendorToTrip(tripId, vendorId, "user-b")`
**Expected:** Throws `"Vendor not found"` — vendor belongs to user-a, so user-b cannot link it
**Why critical:** Without this check, user-b could associate user-a's vendor with their trip,
leaking vendor details through the trip's included relations.

### TC-9: linkClientToTrip cross-user prevention

**Function:** `linkClientToTrip(tripId, clientId, userId)`
**Steps:**
1. Create a client for user-a, note `clientId`
2. Create a trip for user-b, note `tripId`
3. Call `linkClientToTrip(tripId, clientId, "user-b")`
**Expected:** Throws `"Client not found"` — client belongs to user-a
**Same pattern as TC-8 but for clients.

### TC-10: Attachment isolation

**Function:** `getTripAttachments(tripId, userId)`
**Steps:**
1. Create a trip for user-a with an attachment
2. Call `getTripAttachments(tripId, "user-b")`
**Expected:** Throws `"Trip not found"` (verifyTripOwnership fails)

### TC-11: deleteTrip cross-user prevention

**Function:** `deleteTrip(tripId, userId)`
**Steps:**
1. Create a trip for user-a
2. Call `deleteTrip(tripId, "user-b")`
**Expected:** Throws `"Trip not found"`

### TC-12: updateVendor cross-user prevention

**Function:** `updateVendor(vendorId, data, userId)`
**Steps:**
1. Create a vendor for user-a
2. Call `updateVendor(vendorId, { name: "Hacked" }, "user-b")`
**Expected:** Throws `"Vendor not found"`

### TC-13: updateClient cross-user prevention

**Function:** `updateClient(clientId, data, userId)`
**Steps:**
1. Create a client for user-a
2. Call `updateClient(clientId, { name: "Hacked" }, "user-b")`
**Expected:** Throws `"Client not found"`

---

## Manual Testing with curl

All API endpoints require a valid Firebase ID token in the `Authorization` header.

```bash
# Get user-a's trips (should return user-a's data only)
curl -H "Authorization: Bearer <USER_A_TOKEN>" http://localhost:3000/api/travelmanager/trips

# Try to access user-a's trip as user-b (should return 404 or empty)
curl -H "Authorization: Bearer <USER_B_TOKEN>" http://localhost:3000/api/travelmanager/trips/<USER_A_TRIP_ID>

# Try to link user-a's vendor to user-b's trip (should fail)
curl -X POST -H "Authorization: Bearer <USER_B_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"vendorId": "<USER_A_VENDOR_ID>"}' \
  http://localhost:3000/api/travelmanager/trips/<USER_B_TRIP_ID>/vendors
```

---

## Automation Strategy

Once a test auth bypass or test user fixture is available:

1. **Option A (recommended):** Create API-level integration tests using `fetch` with
   pre-configured auth tokens for two test users. Run against a test database.

2. **Option B:** Use Playwright with two browser contexts, each signed in as a
   different Google test account. Slower but tests the full stack.

3. **Option C:** Mock Prisma with an in-memory store and test service functions
   directly. Fastest but doesn't test the real database layer.

---

## Implementation Checklist

- [ ] Set up test user fixtures (2 Firebase test accounts or auth bypass)
- [ ] Set up test database seeding (trips, vendors, clients for each user)
- [ ] Automate TC-1 through TC-13
- [ ] Add to CI pipeline
- [ ] Run against staging environment before each deploy
