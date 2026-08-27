--src/database/sql/audit/003_audit_protection.sql

BEGIN;

-- 1. INMUTABILIDAD DE AUDITORÍA
CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    RAISE EXCEPTION 'VIOLACIÓN DE SEGURIDAD: Los registros de auditoría son inmutables. No se permite UPDATE, DELETE ni TRUNCATE.';
END;
$$;

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

-- 2. ENCADENAMIENTO DE HASHES SERIALIZADO (ADVISORY LOCK + SEQUENCE)
CREATE OR REPLACE FUNCTION compute_audit_log_hash()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_last_hash VARCHAR(64);
    v_formatted_ts TEXT;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtext('audit_logs_chain'));

    SELECT current_hash INTO v_last_hash
    FROM audit_logs
    ORDER BY sequence_num DESC
    LIMIT 1;

    v_formatted_ts := to_char(NEW.timestamp AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"');

    NEW.previous_hash := COALESCE(v_last_hash, '');
    NEW.current_hash := encode(
        digest(
            NEW.previous_hash || 
            NEW.action::text || 
            v_formatted_ts || 
            COALESCE(NEW.actor_id::text, '') || 
            COALESCE(NEW.election_id::text, '') || 
            NEW.metadata::text,
            'sha256'
        ),
        'hex'
    );
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_compute_audit_hash ON audit_logs;
CREATE TRIGGER trg_compute_audit_hash
BEFORE INSERT ON audit_logs
FOR EACH ROW
EXECUTE FUNCTION compute_audit_log_hash();

-- 3. VERIFICACIÓN DE LA CADENA DE HASHEO
CREATE OR REPLACE FUNCTION verify_audit_chain()
RETURNS TABLE (
    total_records BIGINT,
    is_valid BOOLEAN,
    first_broken_id UUID,
    first_broken_sequence BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    r RECORD;
    v_prev_hash VARCHAR(64) := '';
    v_computed_hash VARCHAR(64);
    v_count BIGINT := 0;
BEGIN
    FOR r IN SELECT * FROM audit_logs ORDER BY sequence_num ASC LOOP
        v_count := v_count + 1;
        
        IF r.previous_hash != v_prev_hash THEN
            RETURN QUERY SELECT v_count, FALSE, r.id, r.sequence_num;
            RETURN;
        END IF;

        v_computed_hash := encode(
            digest(
                r.previous_hash || 
                r.action::text || 
                r.timestamp::text || 
                COALESCE(r.actor_id::text, '') || 
                COALESCE(r.election_id::text, '') || 
                r.metadata::text,
                'sha256'
            ),
            'hex'
        );

        IF r.current_hash != v_computed_hash THEN
            RETURN QUERY SELECT v_count, FALSE, r.id, r.sequence_num;
            RETURN;
        END IF;

        v_prev_hash := r.current_hash;
    END LOOP;

    RETURN QUERY SELECT v_count, TRUE, NULL::UUID, NULL::BIGINT;
END;
$$;

COMMIT;