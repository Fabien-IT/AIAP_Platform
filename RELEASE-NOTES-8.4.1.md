# AIAP Platform 8.4.1

## Fix
- Added the missing opposite Prisma relation `Event.eventPlan` for `EventPlan.event`.
- This resolves Prisma schema validation error P1012 during `prisma generate`/server startup.
- No database migration is required for this relation-only schema correction; the existing 8.4.0 migrations remain unchanged.
