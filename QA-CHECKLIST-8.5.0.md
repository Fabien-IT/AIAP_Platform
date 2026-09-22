# AIAP Platform v8.5.0 — QA Checklist

## Governance
- [ ] Super Admin never appears in member directory or member/finance searches.
- [ ] Only one active President, Vice President, Secretariat, Treasurer and Communication exists.
- [ ] Coordinator uniqueness is enforced per city.
- [ ] Pending members are not shown in the default approved directory.
- [ ] Pending member becomes active only after authorized approval.

## Dashboard statistics
- [ ] Student count matches active members with Student status.
- [ ] Professional count matches active members with Professional status/profession.
- [ ] University/profession/field/city counts exclude Super Admin and pending members.

## Profiles and authentication
- [ ] Every non-Super-Admin role has a member profile.
- [ ] Every role can edit permitted basic profile fields and photo.
- [ ] Login password is visually masked.
- [ ] Forced password-reset account is redirected to Change Password.

## Activities
- [ ] All published activities appear on the public Activities page.
- [ ] Published activities appear in the member portal.
- [ ] Active association members can Participate.
- [ ] Participation count updates after joining/leaving.
- [ ] Communication can upload photos/videos and descriptions.
- [ ] Communication/Event Organizer can inspect participant lists.

## Finance
- [ ] Only Super Admin/Treasurer can manage Finance.
- [ ] Pay creates contribution + linked income transaction + receipt.
- [ ] Receipt prints with member mobile number.
- [ ] Payment edit/delete keeps ledger synchronized.

## Responsive UI
- [ ] Sidebar visible on desktop.
- [ ] Sidebar opens as a mobile drawer.
- [ ] Tables scroll horizontally on small screens where necessary.
- [ ] Login, profile, activity gallery, finance and planning pages remain usable on mobile.
