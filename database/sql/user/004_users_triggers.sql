-- // 004_users_triggers.sql (Refactorizado)
BEGIN;

-- FUNCIÓN BASE: ACTUALIZAR updated_at

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    NEW.updated_at := CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

-- TRIGGER: ACTUALIZAR updated_at

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;

CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- TRIGGER & FUNCIÓN: ACTUALIZAR password_changed_at

CREATE OR REPLACE FUNCTION set_password_changed_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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

-- TRIGGER & FUNCIÓN: AUDITORÍA DE ROL Y ESTADO

CREATE OR REPLACE FUNCTION set_user_audit_timestamps()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    -- Registra automáticamente la fecha de cambio de rol
    IF NEW.role IS DISTINCT FROM OLD.role THEN
        NEW.last_role_change_at := CURRENT_TIMESTAMP;
    END IF;

    -- Registra automáticamente la fecha de cambio de estado
    IF NEW.status IS DISTINCT FROM OLD.status THEN
        NEW.last_status_change_at := CURRENT_TIMESTAMP;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_users_audit_timestamps ON users;

CREATE TRIGGER trg_users_audit_timestamps
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION set_user_audit_timestamps();

COMMIT;