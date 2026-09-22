# AIAP Platform 8.4.3

- Fixed Prisma seed failures caused by duplicate unique `Member.memberNumber` values.
- Seeding now reconciles existing staff users without overwriting their passwords.
- Missing staff member profiles receive a collision-safe member number.
- Existing member profiles and finance history are preserved.
- No database reset is required.
