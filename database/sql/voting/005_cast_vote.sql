BEGIN;

-- FUNCIÓN MAESTRA: EMITIR VOTO SEGURO CON SESIÓN


-- Flujo: bloquea sesión, la marca como exitosa, genera
-- comprobante criptográfico, registra voto cifrado y
-- procesa las selecciones del JSONB.

CREATE OR REPLACE FUNCTION cast_secure_vote_with_session(
    p_session_id UUID,
    p_encrypted_payload TEXT,
    p_payload_hash VARCHAR,
    p_selections JSONB
)
RETURNS VARCHAR
LANGUAGE plpgsql
AS $$
DECLARE
    v_session RECORD;
    v_vote_id UUID;
    v_receipt_code VARCHAR;
    v_selection JSONB;
BEGIN
    -- 1. Bloquear y verificar la sesión
    SELECT * INTO v_session
    FROM voting_sessions
    WHERE id = p_session_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Sesión de votación no encontrada.';
    END IF;

    IF v_session.completed_at IS NOT NULL THEN
        RAISE EXCEPTION 'La sesión ya ha sido finalizada previamente.';
    END IF;

    -- 2. Marcar la sesión como exitosa y completada ANTES de insertar el voto
    -- (satisface el trigger de validación de integridad)
    UPDATE voting_sessions
    SET
        is_successful = TRUE,
        completed_at = CURRENT_TIMESTAMP
    WHERE id = p_session_id;

    -- 3. Generar comprobante criptográfico
    v_receipt_code := encode(gen_random_bytes(32), 'hex');

    -- 4. Registrar voto cifrado
    INSERT INTO votes (
        election_id,
        voter_id,
        session_id,
        receipt_code,
        encrypted_payload,
        payload_hash
    )
    VALUES (
        v_session.election_id,
        v_session.voter_id,
        p_session_id,
        v_receipt_code,
        p_encrypted_payload,
        p_payload_hash
    )
    RETURNING id INTO v_vote_id;

    -- 5. Registrar selecciones
    IF p_selections IS NOT NULL AND jsonb_array_length(p_selections) > 0 THEN
        FOR v_selection IN SELECT * FROM jsonb_array_elements(p_selections)
        LOOP
            INSERT INTO vote_selections (vote_id, ballot_option_id)
            VALUES (v_vote_id, (v_selection->>'option_id')::UUID);
        END LOOP;
    END IF;

    RETURN v_receipt_code;
END;
$$;

COMMIT;