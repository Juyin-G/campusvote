BEGIN;

-- FUNCIÓN: PURGA DE TOKENS CADUCADOS

CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    DELETE FROM password_reset_tokens
    WHERE expires_at < CURRENT_TIMESTAMP - INTERVAL '7 days';

    DELETE FROM email_verification_tokens
    WHERE expires_at < CURRENT_TIMESTAMP - INTERVAL '7 days';
END;
$$;

-- ACL: Revoke default PUBLIC EXECUTE and grant only to application role
REVOKE ALL ON FUNCTION cleanup_expired_tokens() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cleanup_expired_tokens() TO postgres;

COMMIT;

