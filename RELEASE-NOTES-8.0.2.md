# AIAP Platform v8.0.2

## Fix
- Corrected the Prisma schema for the finance transaction reference index.
- Prisma 6 does not support `@index` as a field attribute; the index is now declared correctly at model level with `@@index([reference])`.
- Existing finance migration remains unchanged and does not need to be recreated.

## Upgrade safety
The migration `202609110520_add_transaction_reference` was already applied by v8.0.1. This release only fixes schema validation/generation so the server can start and use the existing column/index.
