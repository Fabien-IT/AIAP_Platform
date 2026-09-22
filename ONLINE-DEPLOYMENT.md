# AIAP online test deployment

## Backend
Use the `server` directory as a Node service. Required environment variables:

- `DATABASE_URL`: Supabase Session Pooler PostgreSQL connection string.
- `JWT_SECRET`: long random production secret.
- `CLIENT_ORIGIN`: the exact public frontend URL.
- `NODE_ENV=production`.

Build: `npm install --omit=dev && npx prisma generate && npx prisma migrate deploy && npm run build`
Start: `npm start`
Health: `/api/health`

## Frontend
Use the `client` directory as a Vite site. Set:

`VITE_API_URL=https://YOUR-BACKEND-DOMAIN/api`

Build: `npm install && npm run build`
Publish: `dist`

## Important
The development upload directory is local/ephemeral. For a persistent public deployment, move profile/activity media to Supabase Storage or another object-storage provider before relying on uploaded media.

Never commit `.env` files or database passwords.
