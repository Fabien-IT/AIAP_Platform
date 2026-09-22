# AIAP Platform v7

A production-oriented, mobile-first PWA and association-management platform for **AIAP — Association des Ivoiriens d’Andhra Pradesh**, serving Ivoirians living across Andhra Pradesh.

## v7 highlights

- Professional AIAP visual system based on the supplied AIAP logo.
- Logo/brand treatment across public home, login, registration and management dashboard.
- Consistent orange / white / green / charcoal palette derived from the logo and Ivorian identity.
- Responsive public navigation and a mobile-friendly management sidebar.
- Public home with community positioning, activities and announcements.
- Public activities, events and privacy-controlled member directory.
- Mandatory profile photo during registration.
- Registration photo validation: JPG/PNG/WebP, maximum 5 MB.
- Server-side rejection of registrations without an AIAP-uploaded photo.
- Membership workflow: Pending → Active/Suspended/Inactive/Rejected.
- Automatic AIAP member number on approval.
- Role-based administration: Super Admin, President, Secretariat, Treasurer, Communication, Member.
- Super Admin user/role management and audit trail.
- Member search/filter and CSV export.
- Activity publishing.
- Event creation and event registration.
- Announcement publishing with priority.
- Finance transaction recording and summary.
- Audit log viewer.
- PWA install/update support.

## Registration photo architecture

The registration flow uploads the profile photo first through `/api/uploads/member-photo`. The server accepts only JPEG, PNG or WebP and limits uploads to 5 MB. The resulting `/uploads/...` path is required by the registration API, so a member cannot bypass the mandatory-photo rule by sending an arbitrary external URL.

For production deployment, replace the local `server/uploads` storage with durable object storage such as S3-compatible storage, Supabase Storage or Cloudinary.

## Roles

| Role | Scope |
|---|---|
| Super Admin | Full platform, users, roles, security, audit and system administration |
| President | Association oversight, reports and financial visibility |
| Secretariat | Member verification, records and administrative workflows |
| Treasurer | Contributions, income, expenses and financial reporting |
| Communication | Activities, gallery, announcements and public communication |
| Member | Own account/profile and community participation |

## Local development

1. Install PostgreSQL.
2. Copy `server/.env.example` to `server/.env`.
3. Set a strong `JWT_SECRET`.
4. Install root/client/server dependencies.
5. Run `npx prisma generate` and `npx prisma migrate dev --name init` from `server`.
6. Set `SEED_ADMIN_PASSWORD` and run `npm run seed` from `server`.
7. Run `npm run dev` from the project root.

The seed creates development accounts for all five official administrative roles. Never reuse development credentials in production.

## Production hardening before public launch

- HTTPS everywhere.
- Managed PostgreSQL with backups.
- Durable object storage for photos/documents.
- Password reset and email verification.
- Per-account password management and credential rotation.
- Secure HttpOnly/SameSite session cookies instead of browser localStorage JWTs.
- Rate limiting/WAF and monitoring.
- Email/SMS notifications for membership decisions.
- Privacy/consent policy for public profiles and emergency contacts.
- Automated tests for every RBAC boundary and critical workflow.
- Migration from deprecated Prisma `package.json#prisma` configuration to `prisma.config.ts` before Prisma 7.
