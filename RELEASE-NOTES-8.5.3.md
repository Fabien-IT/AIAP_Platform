# AIAP Platform 8.5.3

- Fixed leadership/coordinator migration: Member.city is used for coordinator uniqueness.
- Added User and Member triggers so coordinator uniqueness is enforced on role/active/city changes.
- Existing duplicate active seats are normalized deterministically.
- No database reset required.
