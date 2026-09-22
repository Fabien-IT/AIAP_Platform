# AIAP Platform v8.5.15

## Final role and member-directory cleanup
- Every association role except Super Admin is represented by a member record.
- Coordinator can access Members as a read-only, city-scoped directory.
- Coordinator detail/export access is restricted to the assigned city.
- Member directory shows mobile number and association role.
- Association contact cards show photos, role, city and mobile number.
- Vice President has the same member detail/edit permissions as President.
- Super Admin remains excluded from association membership.
- Dashboard/profile copy is simplified for demonstration use.
- Expired sessions continue to redirect cleanly to login.
