BEGIN;

-- FUNCIÓN: PREVENIR MODIFICACIÓN DE AUDIT LOGS

CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'VIOLACIÓN DE SEGURIDAD: Los registros de auditoría son inmutables. No se permite UPDATE, DELETE ni TRUNCATE.';
END;
$$;

-- TRIGGERS: PROTECCIÓN DE INMUTABILIDAD

DROP TRIGGER IF EXISTS trg_prevent_audit_update ON audit_logs;

CREATE TRIGGER trg_prevent_audit_update
BEFORE UPDATE ON audit_logs
FOR EACH STATEMENT
EXECUTE FUNCTION prevent_audit_log_modification();

DROP TRIGGER IF EXISTS trg_prevent_audit_delete ON audit_logs;

CREATE TRIGGER trg_prevent_audit_delete
BEFORE DELETE ON audit_logs
FOR EACH STATEMENT
EXECUTE FUNCTION prevent_audit_log_modification();

DROP TRIGGER IF EXISTS trg_prevent_audit_truncate ON audit_logs;

CREATE TRIGGER trg_prevent_audit_truncate
BEFORE TRUNCATE ON audit_logs
FOR EACH STATEMENT
EXECUTE FUNCTION prevent_audit_log_modification();

COMMIT;