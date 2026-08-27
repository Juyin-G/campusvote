-- 007_email_verification.sql (Versión Final Completa)

BEGIN;

-- TABLA: EMAIL VERIFICATION TOKENS

CREATE TABLE IF NOT EXISTS email_verification_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    is_used BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_email_verification_tokens_token_hash
        UNIQUE (token_hash),

    CONSTRAINT chk_email_verification_tokens_expiry
        CHECK (expires_at > created_at)
);

-- Búsqueda de tokens emitidos por usuario
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_user
    ON email_verification_tokens (user_id, created_at DESC);


-- FUNCIÓN: GENERAR TOKEN DE VERIFICACIÓN

CREATE OR REPLACE FUNCTION generate_email_verification_token(
    p_user_id UUID
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
    WHERE id = p_user_id
      AND status IN ('PENDING', 'ACTIVE') 
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    -- Rate limit: máximo 5 tokens por hora
    IF (
        SELECT count(*)
        FROM public.email_verification_tokens
        WHERE user_id = v_user_id
          AND created_at > CURRENT_TIMESTAMP - INTERVAL '1 hour'
    ) >= 5 THEN
        RETURN NULL;
    END IF;

    -- Invalidar tokens anteriores pendientes
    UPDATE public.email_verification_tokens
    SET is_used = TRUE
    WHERE user_id = v_user_id
      AND is_used = FALSE;

    v_raw_token := encode(gen_random_bytes(32), 'hex');
    v_token_hash := encode(digest(v_raw_token, 'sha256'), 'hex');

    INSERT INTO public.email_verification_tokens (
        user_id,
        token_hash,
        expires_at
    ) VALUES (
        v_user_id,
        v_token_hash,
        CURRENT_TIMESTAMP + INTERVAL '24 hours'
    );

    RETURN v_raw_token;
END;
$$;

-- ACL: Permisos de función
REVOKE ALL ON FUNCTION generate_email_verification_token(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION generate_email_verification_token(UUID) TO app_user;


-- FUNCIÓN: VERIFICAR EMAIL CON TOKEN

CREATE OR REPLACE FUNCTION verify_email_with_token(
    p_raw_token TEXT
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
    IF p_raw_token IS NULL OR length(trim(p_raw_token)) = 0 THEN
        RETURN FALSE;
    END IF;

    v_token_hash := encode(digest(p_raw_token, 'sha256'), 'hex');

    SELECT user_id
    INTO v_user_id
    FROM public.email_verification_tokens
    WHERE token_hash = v_token_hash
      AND is_used = FALSE
      AND expires_at > CURRENT_TIMESTAMP
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- Actualiza usuario a verificado y transiciona de PENDING a ACTIVE de forma segura
    UPDATE public.users
    SET is_verified = TRUE,
        status = CASE WHEN status = 'PENDING' THEN 'ACTIVE'::user_status ELSE status END, 
        updated_at = CURRENT_TIMESTAMP
    WHERE id = v_user_id;

    -- Invalida todos los tokens pendientes del usuario
    UPDATE public.email_verification_tokens
    SET is_used = TRUE
    WHERE user_id = v_user_id
      AND is_used = FALSE;

    RETURN TRUE;
END;
$$;

-- ACL: Permisos de función
REVOKE ALL ON FUNCTION verify_email_with_token(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION verify_email_with_token(TEXT) TO app_user;

-- PERMISOS TABLA (ACL)
GRANT SELECT, INSERT, UPDATE, DELETE ON email_verification_tokens TO app_user;

COMMIT;