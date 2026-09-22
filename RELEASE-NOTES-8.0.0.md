# AIAP Platform v8.0.0

## Role-specific operations
- Member accounts are routed to a dedicated **My AIAP** portal instead of the management dashboard.
- Members see only published announcements, published activities, and published events in the member portal.
- Members can edit only their own basic profile fields and can change their profile photo.
- Members can view and print their own payment receipts.
- Member navigation no longer exposes the public member directory.

## Secretariat / leadership
- Secretariat, President and Super Admin retain authenticated member administration.
- Member edit now supports secure profile-photo upload.
- Delete action is visibly present for all directory rows; official association accounts show a disabled/protected Delete control and must be deactivated instead.
- Member directory filters now cover member type, membership status, city, university/organization, field of study, profession/function and association role.
- Directory print/export retains member photos, global statistics and organizational information.

## Communication / activities
- Activities support cover-image upload (JPG/PNG/WebP, 8 MB maximum).
- Super Admin and Communication can create, edit and delete activities.

## Treasury / finance
- Super Admin, President and Treasurer have the same finance workspace.
- Active members appear in a payment desk with **Pay**.
- A payment creates a Contribution and linked INCOME transaction atomically.
- Every payment gets an AIAP receipt number and printable receipt.
- Payments have **Print, Edit and Delete** actions.
- Manual finance transactions support add/edit/delete. Contribution-linked transactions are intentionally managed from the payment ledger so financial records stay synchronized.

## Audit logs
- Entity ID is explained in the UI and can be copied. It is the internal record ID used to trace an exact member/event/transaction in support or API work; it is not the public member number.

## Data safety
- No Prisma schema migration is required for this release. Existing PostgreSQL data remains the source of truth.
- Re-activating a member preserves an existing AIAP member number instead of generating a new number.

## Validation
- `client/src/App.tsx` and `server/src/server.ts` were syntax/transpile validated. A complete dependency-backed production build was not available in the packaging environment, so run the normal `npm install` / `npm run build` in the target machine before production deployment.
