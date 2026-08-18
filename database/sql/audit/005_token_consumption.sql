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
    -- 1. Calcular hash SHA-256 del token plano entrante
    v_token_hash := encode(digest(p_raw_token, 'sha256'), 'hex');

    -- 2. Bloqueo pesimista sobre el token hasheado
    SELECT user_id, used_at, expires_at
    INTO v_user_id, v_used_at, v_expires_at
    FROM one_time_tokens
    WHERE token_hash = v_token_hash
      AND election_id = p_election_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Token inválido o no pertenece a esta elección.';
    END IF;

    -- 3. Verificación de estado de uso
    IF v_used_at IS NOT NULL THEN
        RAISE EXCEPTION 'El token ya ha sido utilizado.';
    END IF;

    -- 4. Verificación de vigencia
    IF v_expires_at <= CURRENT_TIMESTAMP THEN
        RAISE EXCEPTION 'El token ha expirado.';
    END IF;

    -- 5. Consumo atómico
    UPDATE one_time_tokens
    SET used_at = CURRENT_TIMESTAMP
    WHERE token_hash = v_token_hash AND election_id = p_election_id;

    RETURN v_user_id;
END;
$$;

COMMIT;