-- Enforce association leadership seats and one active Coordinator per city.
-- City is stored on Member, not User, so coordinator uniqueness is enforced
-- by both a User trigger (role/active changes) and a Member trigger (city changes).

-- Normalize existing duplicate leadership seats: keep the oldest active seat.
WITH ranked_seats AS (
  SELECT id,
         row_number() OVER (PARTITION BY role ORDER BY "createdAt", id) AS rn
  FROM "User"
  WHERE active = true
    AND role IN ('PRESIDENT','VICE_PRESIDENT','SECRETARIAT','TREASURER','COMMUNICATION')
)
UPDATE "User" u
SET active = false
FROM ranked_seats r
WHERE u.id = r.id
  AND r.rn > 1;

-- Normalize existing duplicate active coordinators by Member.city.
WITH ranked_coordinators AS (
  SELECT u.id,
         row_number() OVER (
           PARTITION BY lower(trim(coalesce(m.city, '')))
           ORDER BY u."createdAt", u.id
         ) AS rn
  FROM "User" u
  JOIN "Member" m ON m."userId" = u.id
  WHERE u.active = true
    AND u.role = 'COORDINATOR'
    AND nullif(trim(m.city), '') IS NOT NULL
)
UPDATE "User" u
SET active = false
FROM ranked_coordinators r
WHERE u.id = r.id
  AND r.rn > 1;

CREATE OR REPLACE FUNCTION enforce_aiap_leadership_seats()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  existing_count integer;
  seat_label text;
  new_city text;
BEGIN
  IF NEW.active = true THEN
    IF NEW.role IN ('PRESIDENT','VICE_PRESIDENT','SECRETARIAT','TREASURER','COMMUNICATION') THEN
      SELECT count(*) INTO existing_count
      FROM "User" u
      WHERE u.active = true
        AND u.role = NEW.role
        AND u.id <> NEW.id;

      IF existing_count > 0 THEN
        seat_label := replace(initcap(lower(NEW.role::text)), '_', ' ');
        RAISE EXCEPTION 'Only one active % is allowed.', seat_label
          USING ERRCODE = '23505';
      END IF;
    ELSIF NEW.role = 'COORDINATOR' THEN
      -- User.role/active can change before Member.city is available.
      SELECT m.city INTO new_city
      FROM "Member" m
      WHERE m."userId" = NEW.id
      LIMIT 1;

      IF nullif(trim(new_city), '') IS NOT NULL THEN
        SELECT count(*) INTO existing_count
        FROM "User" u
        JOIN "Member" m ON m."userId" = u.id
        WHERE u.active = true
          AND u.role = 'COORDINATOR'
          AND lower(trim(coalesce(m.city, ''))) = lower(trim(new_city))
          AND u.id <> NEW.id;

        IF existing_count > 0 THEN
          RAISE EXCEPTION 'Only one active Coordinator is allowed per city: %.', new_city
            USING ERRCODE = '23505';
        END IF;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION enforce_aiap_coordinator_city()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  existing_count integer;
  user_role text;
  user_active boolean;
BEGIN
  SELECT u.role::text, u.active INTO user_role, user_active
  FROM "User" u
  WHERE u.id = NEW."userId"
  LIMIT 1;

  IF user_role = 'COORDINATOR'
     AND user_active = true
     AND nullif(trim(NEW.city), '') IS NOT NULL THEN
    SELECT count(*) INTO existing_count
    FROM "Member" m
    JOIN "User" u ON u.id = m."userId"
    WHERE u.active = true
      AND u.role = 'COORDINATOR'
      AND lower(trim(coalesce(m.city, ''))) = lower(trim(NEW.city))
      AND m.id <> NEW.id;

    IF existing_count > 0 THEN
      RAISE EXCEPTION 'Only one active Coordinator is allowed per city: %.', NEW.city
        USING ERRCODE = '23505';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_aiap_leadership_seats ON "User";
CREATE TRIGGER trg_enforce_aiap_leadership_seats
BEFORE INSERT OR UPDATE OF role, active ON "User"
FOR EACH ROW
EXECUTE FUNCTION enforce_aiap_leadership_seats();

DROP TRIGGER IF EXISTS trg_enforce_aiap_coordinator_city ON "Member";
CREATE TRIGGER trg_enforce_aiap_coordinator_city
BEFORE INSERT OR UPDATE OF "userId", city ON "Member"
FOR EACH ROW
EXECUTE FUNCTION enforce_aiap_coordinator_city();
