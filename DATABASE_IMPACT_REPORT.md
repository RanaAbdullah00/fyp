# Database Impact Report

**Date:** 2026-06-18

## Migration

**File:** `transpak-backend/db/migrations/033_capacity_status_lifecycle.sql`  
**Schema guard version:** 033

## Listing status enum

Before: `open`, `booked`, `closed`  
After: `open`, `requested`, `accepted`, `active`, `delivered`, `closed`, `expired`

## Request status enum

Added: `delivered`, `expired` to `carrier_space_requests.status` CHECK constraint.

## Data backfill

- `booked` listings → `accepted`
- Scheduler-closed listings with past availability → `expired`

## Deploy requirement

Run `npm run db:migrate` on backend **before** deploying API changes to production (Render startup hook).

## Rollback note

Down-migration not provided; rollback requires manual SQL if needed. Non-destructive backfill only.
