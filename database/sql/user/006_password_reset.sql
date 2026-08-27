-- 006_password_reset.sql (Versión Final Completa)

BEGIN;

-- TABLA: PASSWORD RESET TOKENS

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    is_used BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_password_reset_tokens_token_hash
        UNIQUE (token_hash),

    CONSTRAINT chk_password_reset_tokens_expiry
        CHECK (expires_at > created_at)
);

-- Búsqueda de historial de peticiones por usuario
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user
    ON password_reset_tokens (user_id, created_at DESC);


-- FUNCIÓN: GENERAR TOKEN DE RECUPERACIÓN

CREATE OR REPLACE FUNCTION generate_password_reset_token(
    p_email CITEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_raw_token TEXT;
    v_token_hash TEXT;
BEGIN
    SELECT id
    INTO v_user_id
    FROM public.users
    WHERE email = p_email
      AND status = 'ACTIVE' 
      AND auth_provider = 'LOCAL'
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    -- Rate limit: máximo 5 tokens por hora
    IF (
        SELECT count(*)
        FROM public.password_reset_tokens
        WHERE user_id = v_user_id
          AND created_at > CURRENT_TIMESTAMP - INTERVAL '1 hour'
    ) >= 5 THEN
        RETURN NULL;
    END IF;

    -- Invalidar tokens anteriores pendientes
    UPDATE public.password_reset_tokens
    SET is_used = TRUE
    WHERE user_id = v_user_id
      AND is_used = FALSE;

    v_raw_token := encode(gen_random_bytes(32), 'hex');
    v_token_hash := encode(digest(v_raw_token, 'sha256'), 'hex');

    INSERT INTO public.password_reset_tokens (
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

-- ACL: Permisos de función
REVOKE ALL ON FUNCTION generate_password_reset_token(CITEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION generate_password_reset_token(CITEXT) TO app_user;


-- FUNCIÓN: RESET PASSWORD CON TOKEN

CREATE OR REPLACE FUNCTION reset_password_with_token(
    p_raw_token TEXT,
    p_new_password_hash TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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
    FROM public.password_reset_tokens
    WHERE token_hash = v_token_hash
      AND is_used = FALSE
      AND expires_at > CURRENT_TIMESTAMP
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- Actualiza usuario y resetea contadores de bloqueo
    UPDATE public.users
    SET
        password = p_new_password_hash,
        must_change_password = FALSE,
        failed_login_attempts = 0,
        locked_until = NULL,
        password_changed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = v_user_id;

    -- Revoca todas las sesiones JWT (Refresh Tokens) activas por seguridad
    UPDATE public.refresh_tokens
    SET revoked_at = CURRENT_TIMESTAMP
    WHERE user_id = v_user_id 
      AND revoked_at IS NULL;

    -- Invalida los tokens consumidos
    UPDATE public.password_reset_tokens
    SET is_used = TRUE
    WHERE user_id = v_user_id
      AND is_used = FALSE;

    RETURN TRUE;
END;
$$;

-- ACL: Permisos de función
REVOKE ALL ON FUNCTION reset_password_with_token(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION reset_password_with_token(TEXT, TEXT) TO app_user;

-- PERMISOS TABLA (ACL)
GRANT SELECT, INSERT, UPDATE, DELETE ON password_reset_tokens TO app_user;

COMMIT;