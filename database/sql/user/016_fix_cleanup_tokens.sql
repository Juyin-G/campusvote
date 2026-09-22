-- Fix #5: Eliminar referencia a tabla inexistente one_time_tokens
-- Problema: cleanup_expired_tokens() intentaba hacer DELETE FROM one_time_tokens,
-- pero la tabla no existe (fue eliminada como vestigio de ELECTIONS).
-- Solución: Sobrescribir la función eliminando la línea del DELETE fantasma.

BEGIN;

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

    -- NOTA: one_time_tokens fue eliminado. No se requiere limpieza.
END;
$$;

-- ACL: Permisos de función (mantener los mismos que 009)
REVOKE ALL ON FUNCTION cleanup_expired_tokens() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cleanup_expired_tokens() TO app_user;

-- Mensaje de confirmación (envuelto en bloque DO para ser válido en PL/pgSQL)
DO $$
BEGIN
    RAISE NOTICE 'Función cleanup_expired_tokens() corregida: eliminada referencia a one_time_tokens';
END $$;

COMMIT;