--src/database/sql/results/004_tally_votes.sql

BEGIN;

-- FUNCIÓN MAESTRA: ESCRUTINIO DE VOTOS (SE EJECUTA ANTES DE CERTIFICAR)

CREATE OR REPLACE FUNCTION tally_election_votes(p_election_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_status VARCHAR(20);
BEGIN
    SELECT status INTO v_status
    FROM elections
    WHERE id = p_election_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Elección no encontrada.';
    END IF;

    IF v_status != 'CLOSED' THEN
        RAISE EXCEPTION 'El escrutinio solo se puede realizar en elecciones CERRADAS. Estado actual: %', v_status;
    END IF;

    DELETE FROM tallies WHERE election_id = p_election_id;

    INSERT INTO tallies (
        election_id,
        position_id,
        option_id,
        votes_count
    )
    SELECT 
        v.election_id,
        bp.position_id,
        vs.ballot_option_id,
        COUNT(*)::INTEGER AS votes_count
    FROM votes v
    JOIN vote_selections vs ON v.id = vs.vote_id
    JOIN ballot_options bo ON vs.ballot_option_id = bo.id
    JOIN ballot_positions bp ON bo.ballot_position_id = bp.id
    WHERE v.election_id = p_election_id
    GROUP BY v.election_id, bp.position_id, vs.ballot_option_id;
END;
$$;

REVOKE ALL ON FUNCTION tally_election_votes(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tally_election_votes(UUID) TO app_user;

COMMIT;