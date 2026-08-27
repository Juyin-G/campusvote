-- // 006_functions.sql (Refactorizado)

BEGIN;

-- 1. TRIGGER DE INMUTABILIDAD DE BOLETA
CREATE OR REPLACE FUNCTION enforce_ballot_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_status election_status_type;
    v_election_id UUID;
BEGIN
    v_election_id := COALESCE(NEW.election_id, OLD.election_id);

    SELECT status INTO v_status FROM elections WHERE id = v_election_id;

    IF v_status IS NULL OR v_status NOT IN ('DRAFT', 'SCHEDULED') THEN
        RAISE EXCEPTION 'Estructura de boleta bloqueada: la elección está en estado %.', COALESCE(v_status::text, 'INEXISTENTE');
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$;

-- Aplicación del candado en caliente a las 3 tablas del módulo
DROP TRIGGER IF EXISTS trg_ballots_lock ON ballots;
CREATE TRIGGER trg_ballots_lock
BEFORE INSERT OR UPDATE OR DELETE ON ballots
FOR EACH ROW EXECUTE FUNCTION enforce_ballot_immutability();

DROP TRIGGER IF EXISTS trg_ballot_positions_lock ON ballot_positions;
CREATE TRIGGER trg_ballot_positions_lock
BEFORE INSERT OR UPDATE OR DELETE ON ballot_positions
FOR EACH ROW EXECUTE FUNCTION enforce_ballot_immutability();

DROP TRIGGER IF EXISTS trg_ballot_options_lock ON ballot_options;
CREATE TRIGGER trg_ballot_options_lock
BEFORE INSERT OR UPDATE OR DELETE ON ballot_options
FOR EACH ROW EXECUTE FUNCTION enforce_ballot_immutability();

-- 2. FUNCIONES DE NEGOCIO
CREATE OR REPLACE FUNCTION get_active_ballot(
    p_election_id UUID
)
RETURNS TABLE (
    ballot_id UUID,
    version INTEGER,
    generated_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
PARALLEL SAFE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT id, version, generated_at
    FROM ballots
    WHERE election_id = p_election_id
      AND is_active = TRUE
    LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION create_ballot_version(
    p_election_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_new_version INTEGER;
    v_new_ballot_id UUID;
    v_election_status election_status_type;
BEGIN
    SELECT status INTO v_election_status 
    FROM elections 
    WHERE id = p_election_id 
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'La elección con ID % no existe.', p_election_id;
    END IF;

    IF v_election_status NOT IN ('DRAFT', 'SCHEDULED') THEN
        RAISE EXCEPTION 'No se puede crear una nueva versión de boleta para una elección en estado %.', v_election_status;
    END IF;

    SELECT COALESCE(MAX(version), 0) + 1
    INTO v_new_version
    FROM ballots
    WHERE election_id = p_election_id;

    UPDATE ballots
    SET is_active = FALSE
    WHERE election_id = p_election_id
      AND is_active = TRUE;

    INSERT INTO ballots (election_id, version, is_active)
    VALUES (p_election_id, v_new_version, TRUE)
    RETURNING id INTO v_new_ballot_id;

    RETURN v_new_ballot_id;
END;
$$;

CREATE OR REPLACE FUNCTION validate_ballot_completeness(
    p_ballot_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT 
        EXISTS (
            SELECT 1 
            FROM ballot_positions 
            WHERE ballot_id = p_ballot_id
        )
        AND NOT EXISTS (
            SELECT 1
            FROM ballot_positions bp
            WHERE bp.ballot_id = p_ballot_id
              AND NOT EXISTS (
                  SELECT 1
                  FROM ballot_options bo
                  WHERE bo.ballot_position_id = bp.id
              )
        );
$$;

-- 3. HARDENING DE PERMISOS (REVOKE / GRANT)
REVOKE ALL ON FUNCTION get_active_ballot(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_active_ballot(UUID) TO app_user;

REVOKE ALL ON FUNCTION create_ballot_version(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_ballot_version(UUID) TO app_user;

REVOKE ALL ON FUNCTION validate_ballot_completeness(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION validate_ballot_completeness(UUID) TO app_user;

COMMIT;