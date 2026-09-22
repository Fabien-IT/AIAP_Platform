# AIAP Platform v8.5.4

## Directory logic hardening
- Reworked member-directory filters so Member Type is explicitly separated from Profession.
- Student/Professional counts are calculated from the same active member-type field used by filtering.
- Member type filtering is case-insensitive server-side.
- Directory statistic label changed to “Members in view” to match the active filters.
- Filter controls now have explicit labels, preventing the previous visual mismatch where “Student” appeared under the wrong filter.
- Pending/rejected/inactive members remain excluded from the default Active directory and only appear when the membership-status filter explicitly requests them.
- Super Admin accounts remain excluded from association-member data.
