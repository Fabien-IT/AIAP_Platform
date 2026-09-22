# AIAP Platform 8.5.2

## Migration hotfix
- Replaced the PostgreSQL partial unique indexes used for association seats with a trigger-based constraint.
- Enforces one active President, Vice President, Secretariat, Treasurer and Communication account.
- Enforces one active Coordinator per city.
- Automatically deactivates duplicate active leadership/coordinator records before the trigger is installed.
- Preserves existing data; no reset is required.
