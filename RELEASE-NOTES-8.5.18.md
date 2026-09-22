# AIAP Platform v8.5.18

## Location & Coordinator assignment
- Added a predefined Andhra Pradesh city catalog for registration and Coordinator assignment.
- Added a city-to-institution catalog; student registration now selects the institution from the chosen city instead of typing it manually.
- Added server-side validation so student registrations cannot submit a city/institution combination outside the catalog.
- Added a Coordinator city selector to Super Admin > Users & Roles.
- Saving a Coordinator city updates the associated member profile and enforces one active Coordinator per city.
- Kept the existing PostgreSQL schema unchanged; no migration is required.
