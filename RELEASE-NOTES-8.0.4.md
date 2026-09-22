# AIAP Platform v8.0.4

## Installation fix
- Removed the unused `@vite-pwa/assets-generator` dependency from the client.
- This dependency pulled `sharp@0.32.6`, which can fail to install on Node.js 24 / Kali when its native libvips build is attempted.
- The application already uses an SVG PWA icon directly in the Vite PWA configuration, so the asset generator is not required at runtime or build time.
- No database schema or migration changes in this release.

## Upgrade
Use the existing `server/.env` unchanged. No `prisma migrate reset` is required.
