# AIAP Platform v8.4.0

## Event Organizer & Planning
- Added `EVENT_ORGANIZER` association role.
- Event Organizer can manage the event calendar and use a dedicated planning center.
- Added event plans covering objectives, audience, attendance, budget, program, venue/logistics, transport, accommodation, catering, security, communications, contingency and notes.
- Added execution tasks with assignee, due date, priority and status tracking.
- Added browser-generated AIAP Event Planning Dossier: use **Generate plan PDF** and choose **Save as PDF** in the browser print dialog.

## Activities & Memories
- Added a polished **More** activity detail page.
- Activity memories support images and videos.
- Each memory can have an individual caption/description.
- Communication and Super Admin can select an existing activity and manage its memories.
- Public activity detail pages display the complete published gallery and captions.

## Dashboard Intelligence
- Leadership overview now includes university/organization, student-university, profession/function, field-of-study and city statistics.
- Communication overview includes activity, memory/photo, video and event metrics.
- Event Organizer overview includes upcoming-event, planned-event and overdue-task indicators.

## Profiles
- Every authenticated association role can edit its own permitted basic profile information and profile photo.

## Security & Data
- Added additive Prisma migration for the new role, activity captions and event-planning tables.
- Existing data is preserved; do not reset the database.
