# AIAP Platform 8.5.7

## Member type logic hardening

- The Member Type filter is now enforced by the API using the same classification rule as the dashboard.
- Student = active association member whose status is Student OR whose profession/function is Student.
- Non-student = active association member matching neither Student condition.
- The search query and Member Type condition are combined safely instead of one overwriting the other.
- CSV export uses identical Member Type filtering.
- Super Admin remains excluded from association member records and counts.
