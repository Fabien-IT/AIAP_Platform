# AIAP Platform 8.0.1

## Fixes
- Fixed finance Pay flow by adding the missing `Transaction.reference` database field and incremental Prisma migration.
- Fixed member/profile photo uploads by accepting both `imageUrl` and `photoUrl` upload responses.
- Fixed member self-edit validation when optional phone/profile fields are blank.
- Added explicit backend error reporting and audit logging when member deletion is blocked by financial history.
- Kept financial history protected: members with contribution records must be deactivated rather than hard-deleted.

## Database
- Apply the included incremental migration before starting the API.
- Existing member, contribution and transaction data is preserved.
