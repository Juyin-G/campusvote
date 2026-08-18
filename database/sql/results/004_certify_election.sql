BEGIN;

-- FUNCIÓN MAESTRA: CERTIFICAR ELECCIÓN (GENERAR ACTA)

-- Calcula totales según alcance (UNIVERSITY, FACULTY, PROGRAM),
-- promedia votos en blanco/nulos por posición, y registra el acta.

CREATE OR REPLACE FUNCTION certify_election(p_election_id UUID)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
    v_election RECORD;
    v_total_voters INTEGER;
    v_total_votes_cast INTEGER;
    v_blank_votes INTEGER;
    v_null_votes INTEGER;
    v_result_id UUID;
BEGIN
    -- 1. Verificar estado y obtener metadatos de alcance
    SELECT status, election_type, period_id, faculty_id, program_id
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

    -- 2. Calcular total de votantes elegibles según alcance
    SELECT COUNT(*) INTO v_total_voters
    FROM voter_registries vr
    WHERE vr.period_id = v_election.period_id
      AND vr.is_eligible = TRUE
      AND (
          (v_election.election_type = 'UNIVERSITY') OR
          (v_election.election_type = 'FACULTY' AND vr.program_id IN (
              SELECT p.id FROM programs p WHERE p.faculty_id = v_election.faculty_id
          )) OR
          (v_election.election_type = 'PROGRAM' AND vr.program_id = v_election.program_id)
      );

    -- 3. Calcular total de votos emitidos (papeletas registradas)
    SELECT COUNT(*) INTO v_total_votes_cast
    FROM vote_records
    WHERE election_id = p_election_id;

    -- 4. Promediar votos en blanco y nulos por posición
    -- para mantener consistencia con total_votes_cast
    SELECT
        COALESCE(ROUND(AVG(pos_blank)), 0),
        COALESCE(ROUND(AVG(pos_null)), 0)
    INTO v_blank_votes, v_null_votes
    FROM (
        SELECT
            t.position_id,
            COALESCE(SUM(t.votes_count) FILTER (WHERE bo.option_type = 'BLANK'), 0) AS pos_blank,
            COALESCE(SUM(t.votes_count) FILTER (WHERE bo.option_type = 'NULL'), 0) AS pos_null
        FROM tallies t
        JOIN ballot_options bo ON t.option_id = bo.id
        WHERE t.election_id = p_election_id
        GROUP BY t.position_id
    ) pos_tallies;

    -- 5. Registrar o Actualizar el acta de resultados
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

    -- 6. Cambiar estado a CERTIFIED
    UPDATE elections SET status = 'CERTIFIED' WHERE id = p_election_id;

    RETURN v_result_id;
END;
$$;

COMMIT;