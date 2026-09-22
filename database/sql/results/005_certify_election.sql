--src/database/sql/results/005_certify_election.sql

BEGIN;

-- FUNCIÓN MAESTRA: CERTIFICAR ELECCIÓN Y EMITIR ACTA

CREATE OR REPLACE FUNCTION certify_election(
    p_election_id UUID,
    p_certifier_user_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_election RECORD;
    v_user_role VARCHAR(50);
    v_total_voters INTEGER;
    v_total_votes_cast INTEGER;
    v_empty_ballots INTEGER;
    v_blank_votes INTEGER;
    v_null_votes INTEGER;
    v_result_id UUID;
BEGIN
    -- 0. Autorización explícita del ejecutor (exige cuenta activa)
    SELECT role INTO v_user_role
    FROM users
    WHERE id = p_certifier_user_id
      AND status = 'ACTIVE';

    IF v_user_role IS NULL OR v_user_role NOT IN ('ADMIN', 'SUPERADMIN') THEN
        RAISE EXCEPTION 'Usuario no autorizado para certificar la elección.';
    END IF;

    -- 1. Validar estado y bloquear la fila de la elección
    SELECT status, scope_type, period_id, faculty_id, program_id
    INTO v_election
    FROM elections
    WHERE id = p_election_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Elección no encontrada.';
    END IF;

    IF v_election.status != 'CLOSED' THEN
        RAISE EXCEPTION 'No se puede certificar una elección que no está CERRADA. Estado actual: %', v_election.status;
    END IF;

    -- 2. Ejecutar escrutinio diferido dentro de la misma transacción
    PERFORM tally_election_votes(p_election_id);

    -- 3. Calcular electores según alcance (scope_type)
    SELECT COUNT(*) INTO v_total_voters
    FROM voter_registries vr
    WHERE vr.period_id = v_election.period_id
      AND vr.is_eligible = TRUE
      AND (
          (v_election.scope_type = 'UNIVERSITY') OR
          (v_election.scope_type = 'FACULTY' AND vr.program_id IN (
              SELECT p.id FROM programs p WHERE p.faculty_id = v_election.faculty_id
          )) OR
          (v_election.scope_type = 'PROGRAM' AND vr.program_id = v_election.program_id)
      );

    -- 4. Contar papeletas totales
    SELECT COUNT(*) INTO v_total_votes_cast
    FROM votes
    WHERE election_id = p_election_id;

    -- 5a. Contar papeletas sin selecciones registradas (votos en blanco implícitos)
    SELECT COUNT(*) INTO v_empty_ballots
    FROM votes v
    WHERE v.election_id = p_election_id
      AND NOT EXISTS (
          SELECT 1 FROM vote_selections vs WHERE vs.vote_id = v.id
      );

    -- 5b. Agregación lógica de papeletas en blanco explícitas ('BLANK') y nulas ('VOID')
    SELECT 
        COALESCE(COUNT(CASE WHEN is_blank THEN 1 END), 0) + v_empty_ballots,
        COALESCE(COUNT(CASE WHEN is_null THEN 1 END), 0)
    INTO v_blank_votes, v_null_votes
    FROM (
        SELECT 
            v.id,
            bool_and(bo.option_type = 'BLANK') AS is_blank,
            bool_and(bo.option_type = 'VOID') AS is_null
        FROM votes v
        JOIN vote_selections vs ON v.id = vs.vote_id
        JOIN ballot_options bo ON vs.ballot_option_id = bo.id
        WHERE v.election_id = p_election_id
        GROUP BY v.id
    ) ballot_summary;

    -- 6. Generar/actualizar acta oficial
    INSERT INTO election_results (
        election_id,
        total_voters,
        total_votes_cast,
        blank_votes,
        null_votes,
        certified_at
    )
    VALUES (
        p_election_id,
        v_total_voters,
        v_total_votes_cast,
        v_blank_votes,
        v_null_votes,
        CURRENT_TIMESTAMP
    )
    ON CONFLICT (election_id)
    DO UPDATE SET
        total_voters = EXCLUDED.total_voters,
        total_votes_cast = EXCLUDED.total_votes_cast,
        blank_votes = EXCLUDED.blank_votes,
        null_votes = EXCLUDED.null_votes,
        certified_at = CURRENT_TIMESTAMP,
        published_at = NULL,
        report_pdf = NULL,
        report_hash = NULL,
        report_signature = NULL
    RETURNING id INTO v_result_id;

    -- 7. Transición final de estado
    UPDATE elections SET status = 'CERTIFIED' WHERE id = p_election_id;

    RETURN v_result_id;
END;
$$;

REVOKE ALL ON FUNCTION certify_election(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION certify_election(UUID, UUID) TO app_user;

COMMIT;