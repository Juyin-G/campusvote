-- 008_login_security.sql (Versión Final Completa)

BEGIN;

-- FUNCIÓN: VERIFICAR SI LOGIN ESTÁ PERMITIDO

CREATE OR REPLACE FUNCTION login_is_allowed(
    p_email CITEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT COALESCE(
        (
            SELECT
                status = 'ACTIVE'
                AND (
                    locked_until IS NULL
                    OR locked_until <= CURRENT_TIMESTAMP
                )
            FROM public.users
            WHERE email = p_email
        ),
        FALSE
    );
$$;

-- ACL: Permisos de función
REVOKE ALL ON FUNCTION login_is_allowed(CITEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION login_is_allowed(CITEXT) TO app_user;


-- FUNCIÓN: REGISTRAR INTENTO FALLIDO

CREATE OR REPLACE FUNCTION register_failed_login(
    p_email CITEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    -- UPDATE atómico que previene condiciones de carrera
    UPDATE public.users
    SET 
        failed_login_attempts = CASE 
            WHEN locked_until IS NOT NULL AND locked_until <= CURRENT_TIMESTAMP THEN 1
            ELSE failed_login_attempts + 1
        END,
        locked_until = CASE 
            WHEN (
                CASE 
                    WHEN locked_until IS NOT NULL AND locked_until <= CURRENT_TIMESTAMP THEN 1 
                    ELSE failed_login_attempts + 1 
                END
            ) >= 5 THEN CURRENT_TIMESTAMP + INTERVAL '15 minutes'
            ELSE locked_until
        END
    WHERE email = p_email AND status = 'ACTIVE';

    -- NOTA PARA EL BACKEND (NestJS / Node / Go / Python):
    -- Si la consulta no afectó filas (email no encontrado o inactivo), 
    -- el backend DEBE ejecutar un hashing de comparación falso (dummy hash check) 
    -- para igualar la latencia de respuesta de la CPU y evitar enumeración de usuarios.
END;
$$;

-- ACL: Permisos de función
REVOKE ALL ON FUNCTION register_failed_login(CITEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION register_failed_login(CITEXT) TO app_user;


-- FUNCIÓN: REGISTRAR LOGIN EXITOSO

CREATE OR REPLACE FUNCTION register_successful_login(
    p_email CITEXT,
    p_ip_address VARCHAR(45) DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    UPDATE public.users
    SET
        failed_login_attempts = 0,
        locked_until = NULL,
        last_login = CURRENT_TIMESTAMP,
        last_login_ip = p_ip_address,
        last_login_user_agent = p_user_agent
    WHERE email = p_email
      AND status = 'ACTIVE'
      AND (
          locked_until IS NULL
          OR locked_until <= CURRENT_TIMESTAMP
      );
END;
$$;

-- ACL: Permisos de función
REVOKE ALL ON FUNCTION register_successful_login(CITEXT, VARCHAR, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION register_successful_login(CITEXT, VARCHAR, TEXT) TO app_user;

COMMIT;