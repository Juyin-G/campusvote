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
                is_active = TRUE
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

-- ACL: Revoke default PUBLIC EXECUTE and grant only to application role
REVOKE ALL ON FUNCTION login_is_allowed(CITEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION login_is_allowed(CITEXT) TO postgres;


-- FUNCIÓN: REGISTRAR INTENTO FALLIDO

CREATE OR REPLACE FUNCTION register_failed_login(
    p_email CITEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_attempts INT;
BEGIN
    SELECT CASE
        WHEN locked_until IS NOT NULL AND locked_until <= CURRENT_TIMESTAMP THEN 1
        ELSE failed_login_attempts + 1
    END INTO v_attempts
    FROM public.users
    WHERE email = p_email AND is_active = TRUE;

    IF FOUND THEN
        UPDATE public.users
        SET
            failed_login_attempts = v_attempts,
            locked_until = CASE
                WHEN v_attempts >= 5 THEN CURRENT_TIMESTAMP + INTERVAL '15 minutes'
                ELSE NULL
            END
        WHERE email = p_email AND is_active = TRUE;
    END IF;
END;
$$;

-- ACL: Revoke default PUBLIC EXECUTE and grant only to application role
REVOKE ALL ON FUNCTION register_failed_login(CITEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION register_failed_login(CITEXT) TO postgres;

-- FUNCIÓN: REGISTRAR LOGIN EXITOSO

CREATE OR REPLACE FUNCTION register_successful_login(
    p_email CITEXT
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
        last_login = CURRENT_TIMESTAMP
    WHERE email = p_email
      AND is_active = TRUE
      AND (
          locked_until IS NULL
          OR locked_until <= CURRENT_TIMESTAMP
      );
END;
$$;

-- ACL: Revoke default PUBLIC EXECUTE and grant only to application role
REVOKE ALL ON FUNCTION register_successful_login(CITEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION register_successful_login(CITEXT) TO postgres;

COMMIT;