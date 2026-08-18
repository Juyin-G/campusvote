BEGIN;

-- FUNCIÓN: OBTENER BOLETA ACTIVA POR ELECCIÓN

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
AS $$
    SELECT id, version, generated_at
    FROM ballots
    WHERE election_id = p_election_id
      AND is_active = TRUE
    LIMIT 1;
$$;

-- FUNCIÓN: CREAR NUEVA VERSIÓN DE BOLETA
-- Bloqueo explícito de filas para prevenir versiones duplicadas
-- bajo accesos concurrentes. El índice único parcial
-- uq_ballots_single_active asegura la atomicidad.

CREATE OR REPLACE FUNCTION create_ballot_version(
    p_election_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
    v_current_version INTEGER;
    v_new_version INTEGER;
    v_new_ballot_id UUID;
BEGIN
    PERFORM 1
    FROM ballots
    WHERE election_id = p_election_id
    FOR UPDATE;

    SELECT COALESCE(MAX(version), 0)
    INTO v_current_version
    FROM ballots
    WHERE election_id = p_election_id;

    v_new_version := v_current_version + 1;

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

-- FUNCIÓN: VALIDAR INTEGRIDAD DE BOLETA

-- Verifica que todas las posiciones tengan al menos una opción

CREATE OR REPLACE FUNCTION validate_ballot_completeness(
    p_ballot_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
    v_positions_without_options INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO v_positions_without_options
    FROM ballot_positions bp
    WHERE bp.ballot_id = p_ballot_id
      AND NOT EXISTS (
          SELECT 1
          FROM ballot_options bo
          WHERE bo.ballot_position_id = bp.id
      );

    RETURN v_positions_without_options = 0;
END;
$$;

COMMIT;