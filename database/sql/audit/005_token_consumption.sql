BEGIN;

-- FUNCIÓN MAESTRA: CONSUMIR TOKEN DE UN SOLO USO

CREATE OR REPLACE FUNCTION consume_one_time_token(
    p_raw_token VARCHAR,
    p_election_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
    v_token_hash VARCHAR(64);
    v_user_id UUID;
    v_used_at TIMESTAMPTZ;
    v_expires_at TIMESTAMPTZ;
BEGIN
    -- 1. Hash SHA-256 nativo (sin depender de pgcrypto)
    v_token_hash := encode(sha256(p_raw_token::bytea), 'hex');

    -- 2. Bloqueo pesimista
    SELECT user_id, used_at, expires_at
    INTO v_user_id, v_used_at, v_expires_at
    FROM one_time_tokens
    WHERE token_hash = v_token_hash
      AND election_id = p_election_id
    FOR UPDATE;

    -- 3. Validaciones encadenadas
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Token inválido o no pertenece a esta elección.';
    ELSIF v_used_at IS NOT NULL THEN
        RAISE EXCEPTION 'El token ya ha sido utilizado.';
    ELSIF v_expires_at <= CURRENT_TIMESTAMP THEN
        RAISE EXCEPTION 'El token ha expirado.';
    END IF;

    -- 4. Consumo atómico
    UPDATE one_time_tokens
    SET used_at = CURRENT_TIMESTAMP
    WHERE token_hash = v_token_hash AND election_id = p_election_id;

    RETURN v_user_id;
END;
$$;

COMMIT;