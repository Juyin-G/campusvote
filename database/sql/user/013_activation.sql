-- 013_activation.sql
-- Onboarding de administradores (Opción 1 email / Opción 2 sin email).
--
-- Opción 1: el admin nace en PENDING_ACTIVATION, sin contraseña ni 2FA,
--   y recibe un token de activación por email (24h). Al usarlo define su
--   contraseña; al completar el enrolamiento de 2FA pasa a ACTIVE.
-- Opción 2: sin email configurado, el admin nace ACTIVE con contraseña
--   temporal (must_change_password = TRUE) y debe enrolar 2FA en el primer
--   acceso (must_setup_2fa = TRUE). El login emite un token de onboarding
--   en lugar del JWT final.

BEGIN;

-- Columna que marca cuentas que deben enrolar 2FA en su primer acceso.
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_setup_2fa BOOLEAN NOT NULL DEFAULT FALSE;

-- Relaja el CHECK de contraseña: permite password NULL mientras la cuenta
-- está pendiente de activación (el propio admin la define en el enlace).
ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_users_password_required_for_local;
ALTER TABLE users ADD CONSTRAINT chk_users_password_required_for_local
    CHECK (
        auth_provider != 'LOCAL'
        OR status = 'PENDING_ACTIVATION'
        OR (password IS NOT NULL AND length(password) > 0)
    );

-- TABLA: ACTIVATION TOKENS (mismo patrón que password_reset_tokens)
CREATE TABLE IF NOT EXISTS activation_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    is_used BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_activation_tokens_token_hash
        UNIQUE (token_hash),

    CONSTRAINT chk_activation_tokens_expiry
        CHECK (expires_at > created_at)
);

-- Búsqueda de tokens emitidos por usuario
CREATE INDEX IF NOT EXISTS idx_activation_tokens_user
    ON activation_tokens (user_id, created_at DESC);


-- FUNCIÓN: GENERAR TOKEN DE ACTIVACIÓN (invitación por email)

CREATE OR REPLACE FUNCTION generate_activation_token(
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
      AND status = 'PENDING_ACTIVATION'
      AND auth_provider = 'LOCAL'
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    -- Rate limit: máximo 5 tokens por hora
    IF (
        SELECT count(*)
        FROM public.activation_tokens
        WHERE user_id = v_user_id
          AND created_at > CURRENT_TIMESTAMP - INTERVAL '1 hour'
    ) >= 5 THEN
        RETURN NULL;
    END IF;

    -- Invalidar tokens anteriores pendientes
    UPDATE public.activation_tokens
    SET is_used = TRUE
    WHERE user_id = v_user_id
      AND is_used = FALSE;

    v_raw_token := encode(gen_random_bytes(32), 'hex');
    v_token_hash := encode(digest(v_raw_token, 'sha256'), 'hex');

    INSERT INTO public.activation_tokens (
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
REVOKE ALL ON FUNCTION generate_activation_token(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION generate_activation_token(UUID) TO app_user;


-- FUNCIÓN: ACTIVAR CUENTA CON TOKEN (define la contraseña del admin).
-- Devuelve el UUID del usuario activado (NULL si el token es inválido).
-- La cuenta permanece en PENDING_ACTIVATION hasta completar el 2FA.

CREATE OR REPLACE FUNCTION activate_account_with_token(
    p_raw_token TEXT,
    p_password_hash TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_token_hash TEXT;
    v_user_id UUID;
BEGIN
    IF p_raw_token IS NULL
       OR p_password_hash IS NULL
       OR length(trim(p_raw_token)) = 0
       OR length(p_password_hash) = 0 THEN
        RETURN NULL;
    END IF;

    v_token_hash := encode(digest(p_raw_token, 'sha256'), 'hex');

    SELECT user_id
    INTO v_user_id
    FROM public.activation_tokens
    WHERE token_hash = v_token_hash
      AND is_used = FALSE
      AND expires_at > CURRENT_TIMESTAMP
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    -- Define la contraseña del admin y limpia contadores de bloqueo
    UPDATE public.users
    SET
        password = p_password_hash,
        must_change_password = FALSE,
        must_setup_2fa = TRUE,
        is_verified = TRUE,
        failed_login_attempts = 0,
        locked_until = NULL,
        password_changed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = v_user_id;

    -- Invalida los tokens de activación pendientes
    UPDATE public.activation_tokens
    SET is_used = TRUE
    WHERE user_id = v_user_id
      AND is_used = FALSE;

    RETURN v_user_id;
END;
$$;

-- ACL: Permisos de función
REVOKE ALL ON FUNCTION activate_account_with_token(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION activate_account_with_token(TEXT, TEXT) TO app_user;

-- PERMISOS TABLA (ACL)
GRANT SELECT, INSERT, UPDATE, DELETE ON activation_tokens TO app_user;

COMMIT;