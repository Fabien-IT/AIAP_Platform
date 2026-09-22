# AIAP Platform 8.3.1

- Fixed missing React Router `Navigate` import used by the private /members redirect.
- Development startup now unregisters stale local service workers and clears browser Cache Storage so localhost testing cannot continue serving an older AIAP bundle.
- Public `/members` route redirects to `/` and the public navigation excludes Members.
- Preserves the 8.3.0 role and activity-memory functionality.
