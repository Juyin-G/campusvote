BEGIN;

-- TABLA: PASSWORD RESET TOKENS

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    token_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    is_used BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_password_reset_tokens_token_hash
        UNIQUE (token_hash),

    CONSTRAINT chk_password_reset_tokens_expiry
        CHECK (expires_at > created_at)
);

-- ÍNDICES: PASSWORD RESET TOKENS

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user
    ON password_reset_tokens (user_id, created_at DESC);

-- Corregido: Se remueve CURRENT_TIMESTAMP por no ser inmutable
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_valid
    ON password_reset_tokens (token_hash)
    WHERE is_used = FALSE;

-- FUNCIÓN: GENERAR TOKEN DE RECUPERACIÓN

CREATE OR REPLACE FUNCTION generate_password_reset_token(
    p_email CITEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_raw_token TEXT;
    v_token_hash TEXT;
BEGIN
    SELECT id
    INTO v_user_id
    FROM users
    WHERE email = p_email
      AND is_active = TRUE
      AND auth_provider = 'LOCAL'
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    -- Rate limit: máximo 5 tokens por hora
    IF (
        SELECT count(*)
        FROM password_reset_tokens
        WHERE user_id = v_user_id
          AND created_at > CURRENT_TIMESTAMP - INTERVAL '1 hour'
    ) >= 5 THEN
        RETURN NULL;
    END IF;

    -- Invalidar tokens anteriores
    UPDATE password_reset_tokens
    SET is_used = TRUE
    WHERE user_id = v_user_id
      AND is_used = FALSE;

    v_raw_token := encode(gen_random_bytes(32), 'hex');
    v_token_hash := encode(digest(v_raw_token, 'sha256'), 'hex');

    INSERT INTO password_reset_tokens (
        user_id,
        token_hash,
        expires_at
    ) VALUES (
        v_user_id,
        v_token_hash,
        CURRENT_TIMESTAMP + INTERVAL '1 hour'
    );

    RETURN v_raw_token;
END;
$$;

-- ACL: Revoke default PUBLIC EXECUTE and grant only to application role
REVOKE ALL ON FUNCTION generate_password_reset_token(CITEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION generate_password_reset_token(CITEXT) TO postgres;

-- FUNCIÓN: RESET PASSWORD CON TOKEN

CREATE OR REPLACE FUNCTION reset_password_with_token(
    p_raw_token TEXT,
    p_new_password_hash TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_token_hash TEXT;
    v_user_id UUID;
BEGIN
    IF p_raw_token IS NULL
       OR p_new_password_hash IS NULL
       OR length(p_new_password_hash) = 0 THEN
        RETURN FALSE;
    END IF;

    v_token_hash := encode(digest(p_raw_token, 'sha256'), 'hex');

    SELECT user_id
    INTO v_user_id
    FROM password_reset_tokens
    WHERE token_hash = v_token_hash
      AND is_used = FALSE
      AND expires_at > CURRENT_TIMESTAMP
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    UPDATE users
    SET
        password = p_new_password_hash,
        must_change_password = FALSE,
        failed_login_attempts = 0,
        locked_until = NULL
    WHERE id = v_user_id;

    UPDATE password_reset_tokens
    SET is_used = TRUE
    WHERE user_id = v_user_id
      AND is_used = FALSE;

    RETURN TRUE;
END;
$$;

-- ACL: Revoke default PUBLIC EXECUTE and grant only to application role
REVOKE ALL ON FUNCTION reset_password_with_token(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION reset_password_with_token(TEXT, TEXT) TO postgres;

COMMIT;