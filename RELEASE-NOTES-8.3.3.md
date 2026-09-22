# AIAP Platform v8.3.3

## Fixes
- Restored the missing `ChangePassword` client component used by the mandatory password-change route.
- Preserved the existing login redirect for accounts flagged with `mustChangePassword`.
- Kept the v8.3.2 role separation, activity media, and public-directory privacy changes intact.
- Added the v8.3.3 version metadata to root, client, and server packages.

## Validation
- Checked that `Login`, `ChangePassword`, `Register`, and `NavigateLogin` are all defined before route usage.
- ZIP integrity validated during packaging.
