# AIAP Platform v8.5.11

## Member status persistence fix
- Member editor now sends `status` in the PATCH payload.
- Changing Current status (Student/Professional/etc.) now persists after refresh.
- Student/non-student statistics remain based on Current status.
- No database migration required.
