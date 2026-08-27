-- // 009_cleanup_tokens.sql (Refactorizado)

BEGIN;

-- FUNCIÓN: PURGA DE TOKENS CADUCADOS

CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    -- Limpieza de recuperación de contraseña
    DELETE FROM public.password_reset_tokens
    WHERE expires_at < CURRENT_TIMESTAMP - INTERVAL '7 days';

    -- Limpieza de verificación de email
    DELETE FROM public.email_verification_tokens
    WHERE expires_at < CURRENT_TIMESTAMP - INTERVAL '7 days';

    -- Limpieza de sesiones (refresh tokens) expiradas hace más de 7 días
    DELETE FROM public.refresh_tokens
    WHERE expires_at < CURRENT_TIMESTAMP - INTERVAL '7 days';

    -- Limpieza de tokens OTP (One-Time Tokens) expirados hace más de 7 días
    DELETE FROM public.one_time_tokens
    WHERE expires_at < CURRENT_TIMESTAMP - INTERVAL '7 days';
END;
$$;

-- ACL: Permisos de función
REVOKE ALL ON FUNCTION cleanup_expired_tokens() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cleanup_expired_tokens() TO app_user;

COMMIT;