# AIAP Platform 8.5.14

## Association membership integrity
- Every authenticated association role except SUPER_ADMIN is backed by an active Member profile.
- Existing association role accounts are reconciled at server startup without overwriting profile content.
- Role assignment automatically activates the linked membership record.
- SUPER_ADMIN remains excluded from association membership.

## Session and profile stability
- Expired/invalid API sessions are cleared from local storage and redirected to login instead of leaving the dashboard in a broken state.
- Added a working My Profile page for association users.
- SUPER_ADMIN receives a system-account profile view without requiring a member record.
- Vice President, Treasurer and Coordinator are included in the association contact staff feed.
