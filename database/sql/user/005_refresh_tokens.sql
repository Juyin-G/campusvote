-- 005_refresh_tokens.sql (Corregido - V1)
-- Define la tabla `refresh_tokens` de forma idéntica al modelo Prisma
-- (prisma/schema/user.prisma -> model RefreshToken) y las funciones SQL
-- necesarias para el flujo de sesión (rotación de refresh tokens).

BEGIN;

-- TABLA: REFRESH TOKENS (sesiones JWT de larga duración)
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE
        ON UPDATE NO ACTION,

    token_hash VARCHAR(255) NOT NULL,
    device_info JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip_address VARCHAR(45) NULL,
    expires_at TIMESTAMPTZ(6) NOT NULL,
    revoked_at TIMESTAMPTZ(6) NULL,
    created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_refresh_tokens_token_hash
        UNIQUE (token_hash)
);

-- Índices para búsqueda por usuario y sesiones activas
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user
    ON refresh_tokens (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_active
    ON refresh_tokens (user_id);

-- Función de limpieza de refresh tokens expirados/revocados (usada por 009_cleanup_tokens.sql)
CREATE OR REPLACE FUNCTION cleanup_expired_refresh_tokens()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    DELETE FROM public.refresh_tokens
    WHERE expires_at < CURRENT_TIMESTAMP
       OR revoked_at IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION cleanup_expired_refresh_tokens() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cleanup_expired_refresh_tokens() TO app_user;

-- PERMISOS TABLA (ACL)
GRANT SELECT, INSERT, UPDATE, DELETE ON refresh_tokens TO app_user;

COMMIT;
