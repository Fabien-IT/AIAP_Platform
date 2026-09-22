# AIAP Platform v8.5.8

## Student classification correction

The association member type is now determined by the canonical **Current status** field.

- `Student` status => student member
- Any other non-pending active status => non-student member
- Profession/function is no longer used to override the member type.
- This prevents a member changed from Student to Professional from remaining counted as a student merely because their profession/function text still contains “student”.
- Member Directory student/non-student filters use the same canonical status rule.
- Overview counts continue to reconcile: Students + Non-students = Active Members.
