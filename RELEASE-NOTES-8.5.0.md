# AIAP Platform v8.5.0

Final governance, privacy, responsive-workspace and participation hardening for the association management release.

## Governance and membership
- Super Admin is treated as a technical/system account and is excluded from association-member listings, finance member search, public member information and association statistics.
- Association roles are distinct from membership status.
- Exactly one active President, Vice President, Secretariat, Treasurer and Communication seat is allowed at a time.
- Exactly one active Coordinator is allowed per city at a time.
- Every non-Super-Admin association role requires an associated Member profile.
- Pending registrations stay `PENDING` and are excluded from the default approved member directory until Secretariat/authorized leadership approval.
- Existing duplicate active single-seat legacy roles are reconciled during migration by keeping the earliest account active and deactivating later duplicates.

## Member statistics
- Active-member statistics exclude Super Admin.
- Student and Professional counts are normalized case-insensitively from the member status/profession data.
- University, student-university, profession/function, field-of-study and city totals are derived from active association members.

## Roles and permissions
- Vice President has President-equivalent member/announcement permissions.
- Secretariat retains full member administration.
- Treasurer retains Finance administration.
- Communication manages Activities and Events content.
- Event Organizer owns event planning and execution oversight.
- Super Admin retains technical administration.

## Privacy and profile security
- The public member directory is disabled and the `/members` route redirects away from member records.
- All association users except Super Admin have a member profile.
- Every authenticated role can maintain its own permitted basic profile and profile photo.
- Login and password-change inputs remain masked and use credential-specific browser autocomplete settings.
- Temporary-password accounts remain forced through password change before normal application use.

## Activities and participation
- Every published activity is available through the public Activities & memories experience and the member portal.
- Active association members can Participate/withdraw participation on published activities.
- Participation is unique per member/activity and exposes live counts.
- Communication and Event Organizer can inspect participant lists and member details for published activities.
- Activity memories support photos/videos with individual descriptions/captions.

## Printing and responsive workspace
- Member directory print/CSV includes mobile number.
- Receipt print includes member mobile number.
- Management sidebar is fixed and visible on large screens and uses a mobile drawer on small screens.
- Layouts use responsive grids/overflow handling across desktop, tablet and mobile widths.

## Database safety
- Migrations are additive and do not reset or destroy existing PostgreSQL data.
- Do not run `prisma migrate reset` for this release.
