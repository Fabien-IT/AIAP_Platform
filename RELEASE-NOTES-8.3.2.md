# AIAP Platform v8.3.2

## Fixes
- Restored the authentication UI components removed from the v8.3.1 client build: `AuthShell` and `Login`.
- Fixed the runtime `ReferenceError: Login is not defined` that caused the application to render a blank page.
- Added the AIAP favicon to the client HTML entrypoint.
- Preserved the v8.3.x role separation, private member directory behavior, activity media, and existing database migrations.
