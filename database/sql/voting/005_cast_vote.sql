-- database/sql/voting/005_cast_vote.sql

BEGIN;

CREATE OR REPLACE FUNCTION cast_secure_vote_with_session(
    p_session_id UUID,
    p_voter_id UUID,
    p_encrypted_payload TEXT,
    p_payload_hash VARCHAR,
    p_selections JSONB,
    p_voting_token VARCHAR DEFAULT NULL
)
RETURNS VARCHAR
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_session RECORD;
    v_vote_id UUID;
    v_receipt_code VARCHAR;
    v_allow_blank BOOLEAN;
    v_inserted_count INT := 0;
    v_expected_count INT := 0;
BEGIN
    SELECT * INTO v_session FROM voting_sessions WHERE id = p_session_id FOR UPDATE;

    IF NOT FOUND THEN 
        RAISE EXCEPTION 'Sesión de votación no encontrada.'; 
    END IF;
    
    IF v_session.completed_at IS NOT NULL THEN 
        RAISE EXCEPTION 'La sesión ya ha sido finalizada previamente.'; 
    END IF;

    IF v_session.voter_id != p_voter_id THEN
        RAISE EXCEPTION 'Acceso denegado: La sesión no pertenece al usuario autenticado.';
    END IF;

    -- Consumo defensivo en base de datos si el token es enviado al emitir el voto
    IF p_voting_token IS NOT NULL AND p_voting_token <> '' THEN
        PERFORM audit.consume_voting_access_token(p_voting_token, v_session.election_id);
    END IF;

    SELECT allow_blank_vote INTO v_allow_blank 
    FROM election_rules 
    WHERE election_id = v_session.election_id;
    
    IF p_selections IS NOT NULL AND jsonb_typeof(p_selections) = 'array' THEN
        v_expected_count := jsonb_array_length(p_selections);
    END IF;

    IF v_expected_count = 0 AND COALESCE(v_allow_blank, FALSE) = FALSE THEN
        RAISE EXCEPTION 'La elección no permite votos en blanco.';
    END IF;

    UPDATE voting_sessions 
    SET is_successful = TRUE, completed_at = CURRENT_TIMESTAMP 
    WHERE id = p_session_id;

    v_receipt_code := encode(gen_random_bytes(32), 'hex');

    INSERT INTO votes (election_id, voter_id, session_id, receipt_code, encrypted_payload, payload_hash)
    VALUES (v_session.election_id, v_session.voter_id, p_session_id, v_receipt_code, p_encrypted_payload, p_payload_hash)
    RETURNING id INTO v_vote_id;

    IF v_expected_count > 0 THEN
        WITH inserted AS (
            INSERT INTO vote_selections (vote_id, ballot_option_id)
            SELECT v_vote_id, bo.id
            FROM jsonb_array_elements(p_selections) AS item
            JOIN ballot_options bo ON bo.id = (item->>'option_id')::UUID
            JOIN ballot_positions bp ON bp.id = bo.ballot_position_id
            WHERE bp.election_id = v_session.election_id
            RETURNING id
        )
        SELECT COUNT(*) INTO v_inserted_count FROM inserted;

        IF v_inserted_count != v_expected_count THEN
            RAISE EXCEPTION 'Inconsistencia de datos: Una o más opciones no pertenecen a la elección activa.';
        END IF;

        IF EXISTS (
            SELECT 1
            FROM vote_selections vs
            JOIN ballot_options bo ON bo.id = vs.ballot_option_id
            JOIN ballot_positions bp ON bp.id = bo.ballot_position_id
            WHERE vs.vote_id = v_vote_id
            GROUP BY bp.position_id
            HAVING COUNT(*) > COALESCE(
                (SELECT max_votes_per_position FROM election_rules WHERE election_id = v_session.election_id),
                1
            )
        ) THEN
            RAISE EXCEPTION 'Se excedió el número máximo de selecciones permitidas para un cargo.';
        END IF;
    END IF;

    RETURN v_receipt_code;
END;
$$;

REVOKE ALL ON FUNCTION cast_secure_vote_with_session(UUID, UUID, TEXT, VARCHAR, JSONB, VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cast_secure_vote_with_session(UUID, UUID, TEXT, VARCHAR, JSONB, VARCHAR) TO app_user;

COMMIT;