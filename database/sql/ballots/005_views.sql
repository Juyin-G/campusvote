BEGIN;

-- VISTA: BOLETA COMPLETA (CON POSICIONES Y OPCIONES)

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
    bp.order_index,
    bo.id AS ballot_option_id,
    bo.option_type,
    bo.candidate_list_id,
    cl.name AS candidate_list_name,
    bo.label
FROM ballots b
JOIN ballot_positions bp ON b.id = bp.ballot_id
JOIN positions p ON bp.position_id = p.id
JOIN ballot_options bo ON bp.id = bo.ballot_position_id
LEFT JOIN candidate_lists cl ON bo.candidate_list_id = cl.id
ORDER BY b.id, bp.order_index, bo.id;

-- VISTA: BOLETAS ACTIVAS CON TÍTULO DE ELECCIÓN

CREATE OR REPLACE VIEW v_active_ballots AS
SELECT
    b.*,
    e.title AS election_title
FROM ballots b
JOIN elections e ON b.election_id = e.id
WHERE b.is_active = TRUE;

COMMIT;