# AIAP Platform 8.5.1

## Fix
- Corrected the PostgreSQL partial unique-index predicates in the single-active-seat migration.
- Removed enum-to-text casts from migration predicates because PostgreSQL rejects non-immutable expressions in index predicates.
- Existing association-role data and all previously applied migrations remain preserved.
