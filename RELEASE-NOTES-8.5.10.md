# AIAP Platform v8.5.10

## Member profile simplification
- Removed the **Profession / function** field from registration, member administration, member details, self-profile and member filtering.
- Current status is the sole source of member type classification.
- Legacy database profession storage is retained for compatibility only and is no longer exposed or written by application APIs.
- No Prisma migration is required.
