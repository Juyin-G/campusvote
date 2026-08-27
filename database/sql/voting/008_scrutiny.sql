-- // src/database/sql/voting/008_scrutiny.sql

BEGIN;

-- ==========================================
-- FUNCIÓN: ESCRUTINIO - CONTEO DE VOTOS POR CARGO Y LISTA
-- ==========================================
CREATE OR REPLACE FUNCTION get_election_tally(
    p_election_id UUID
)
RETURNS TABLE (
    position_id UUID,
    position_name VARCHAR,
    candidate_list_id UUID,
    candidate_list_name VARCHAR,
    list_acronym VARCHAR,
    option_type TEXT,
    vote_count BIGINT,
    percentage NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_total_valid_votes BIGINT;
BEGIN
    SELECT COUNT(*) INTO v_total_valid_votes
    FROM votes v
    WHERE v.election_id = p_election_id
      AND v.payload_hash = encode(digest(v.encrypted_payload, 'sha512'), 'hex');

    IF v_total_valid_votes = 0 THEN
        RETURN;
    END IF;

    RETURN QUERY
    WITH valid_selections AS (
        SELECT
            p.id AS pos_id,
            p.name AS pos_name,
            bo.candidate_list_id AS list_id,
            cl.name AS list_name,
            cl.acronym AS list_acronym,
            bo.option_type::TEXT AS opt_type,
            COUNT(vs.id) AS votes_for_option
        FROM vote_selections vs
        JOIN votes v ON vs.vote_id = v.id
        JOIN ballot_options bo ON vs.ballot_option_id = bo.id
        JOIN ballot_positions bp ON bo.ballot_position_id = bp.id
        JOIN positions p ON bp.position_id = p.id
        LEFT JOIN candidate_lists cl ON bo.candidate_list_id = cl.id
        WHERE v.election_id = p_election_id
          AND v.payload_hash = encode(digest(v.encrypted_payload, 'sha512'), 'hex')
        GROUP BY
            p.id, p.name,
            bo.candidate_list_id, cl.name, cl.acronym,
            bo.option_type
    )
    SELECT
        s.pos_id,
        s.pos_name,
        s.list_id,
        s.list_name,
        s.list_acronym,
        s.opt_type,
        s.votes_for_option,
        ROUND(
            (s.votes_for_option::NUMERIC / NULLIF(SUM(s.votes_for_option) OVER (PARTITION BY s.pos_id), 0)::NUMERIC) * 100, 
            2
        ) AS percentage
    FROM valid_selections s
    ORDER BY
        s.pos_name,
        CASE s.opt_type
            WHEN 'CANDIDATE_LIST' THEN 1
            WHEN 'BLANK' THEN 2
            WHEN 'VOID' THEN 3
            ELSE 4
        END,
        s.votes_for_option DESC;
END;
$$;

REVOKE ALL ON FUNCTION get_election_tally(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_election_tally(UUID) TO app_user;


-- ==========================================
-- VISTA: RESUMEN DE PARTICIPACIÓN POR ELECCIÓN
-- ==========================================
CREATE OR REPLACE VIEW v_election_participation AS
SELECT
    e.id AS election_id,
    e.title AS election_title,
    e.status AS election_status,
    e.start_at,
    e.end_at,
    COALESCE(v_stats.total_votes, 0) AS total_votes_cast,
    COALESCE(vr_stats.total_eligible, 0) AS total_eligible_voters,
    CASE 
        WHEN COALESCE(vr_stats.total_eligible, 0) > 0 THEN
            ROUND((COALESCE(v_stats.total_votes, 0)::NUMERIC / vr_stats.total_eligible::NUMERIC) * 100, 2)
        ELSE 0.00
    END AS participation_rate
FROM elections e
LEFT JOIN (
    SELECT election_id, COUNT(*) AS total_votes
    FROM votes
    GROUP BY election_id
) v_stats ON v_stats.election_id = e.id
LEFT JOIN (
    SELECT e_inner.id AS election_id, COUNT(*) AS total_eligible
    FROM elections e_inner
    JOIN voter_registries vr ON vr.period_id = e_inner.period_id AND vr.is_eligible = TRUE
    JOIN programs prog ON vr.program_id = prog.id
    WHERE 
        (e_inner.scope_type = 'UNIVERSITY')
        OR (e_inner.scope_type = 'FACULTY' AND prog.faculty_id = e_inner.faculty_id)
        OR (e_inner.scope_type = 'PROGRAM' AND vr.program_id = e_inner.program_id)
    GROUP BY e_inner.id
) vr_stats ON vr_stats.election_id = e.id;

COMMIT;