BEGIN;

-- TRIGGER: ACTUALIZAR updated_at EN USERS

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;

CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


-- TRIGGER: ACTUALIZAR password_changed_at


CREATE OR REPLACE FUNCTION set_password_changed_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.password IS DISTINCT FROM OLD.password THEN
        NEW.password_changed_at := CURRENT_TIMESTAMP;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_users_password_changed_at ON users;

CREATE TRIGGER trg_users_password_changed_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION set_password_changed_at();

COMMIT;