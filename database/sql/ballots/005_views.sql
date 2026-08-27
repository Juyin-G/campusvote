-- // 005_views.sql (Refactorizado)

BEGIN;

CREATE OR REPLACE VIEW v_ballot_full AS
SELECT
    b.id AS ballot_id,
    b.election_id,
    b.version,
    b.is_active,
    b.generated_at,

    bp.id AS ballot_position_id,
    bp.position_id,
    p.name AS position_name,
    bp.order_index AS position_order_index,

    bo.id AS ballot_option_id,
    bo.option_type,
    bo.candidate_list_id,
    cl.name AS candidate_list_name,
    cl.acronym AS candidate_list_acronym,
    bo.label,
    bo.order_index AS option_order_index
FROM ballots b
LEFT JOIN ballot_positions bp ON b.id = bp.ballot_id
LEFT JOIN positions p ON bp.position_id = p.id
LEFT JOIN ballot_options bo ON bp.id = bo.ballot_position_id
LEFT JOIN candidate_lists cl ON bo.candidate_list_id = cl.id
ORDER BY b.id, bp.order_index, bo.order_index;

CREATE OR REPLACE VIEW v_active_ballots AS
SELECT
    b.id AS ballot_id,
    b.election_id,
    e.title AS election_title,
    e.status AS election_status,
    b.version,
    b.is_active,
    b.generated_at,
    b.created_at,
    b.updated_at
FROM ballots b
JOIN elections e ON b.election_id = e.id
WHERE b.is_active = TRUE;

COMMIT;