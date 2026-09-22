# AIAP Production Security Checklist

Before real member or financial data is used:

- [ ] Set a cryptographically random `JWT_SECRET` (never use the example value).
- [ ] Use managed PostgreSQL with encrypted connections and automated backups.
- [ ] Use HTTPS everywhere and set the production `CLIENT_ORIGIN` explicitly.
- [ ] Add an email provider for account verification and password recovery.
- [ ] Add rate limiting/WAF at the API edge before public launch.
- [ ] Configure object storage with private-by-default uploads and signed URLs for sensitive files.
- [ ] Restrict public member fields to consented information only.
- [ ] Review and test every RBAC endpoint with automated authorization tests.
- [ ] Enable database point-in-time recovery if the chosen provider supports it.
- [ ] Rotate secrets and remove development credentials before deployment.
- [ ] Run dependency vulnerability scanning in CI.
- [ ] Run database migrations as part of controlled deployment, never ad-hoc in production.
- [ ] Keep audit logs append-only from the application role where practical.
- [ ] Establish an AIAP data-retention and privacy policy before collecting sensitive fields.
