# AIAP Platform 8.5.6

## Membership classification consistency

- Student classification is consistent across dashboard and Member Directory.
- A record is treated as Student when either the stored member status or the legacy profession value is `Student`.
- Non-student count is always Active Members minus Student Members.
- Professional classification uses the same dual-field fallback.
- Member edit no longer silently displays Student when the stored status is blank.
- Super Admin remains excluded from association counts and directory results.
