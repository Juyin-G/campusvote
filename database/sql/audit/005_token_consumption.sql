--src/database/sql/audit/005_token_consumption.sql

BEGIN;

CREATE OR REPLACE FUNCTION consume_voting_access_token(
    p_raw_token VARCHAR,
    p_election_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_token_hash VARCHAR(64);
    v_user_id UUID;
    v_used_at TIMESTAMPTZ;
    v_expires_at TIMESTAMPTZ;
BEGIN
    v_token_hash := encode(digest(p_raw_token::bytea, 'sha256'), 'hex');

    SELECT user_id, used_at, expires_at
    INTO v_user_id, v_used_at, v_expires_at
    FROM public.voting_access_tokens
    WHERE token_hash = v_token_hash
      AND election_id = p_election_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Token de acceso inválido o no pertenece a esta elección.';
    ELSIF v_used_at IS NOT NULL THEN
        RAISE EXCEPTION 'El token de acceso ya ha sido utilizado.';
    ELSIF v_expires_at <= CURRENT_TIMESTAMP THEN
        RAISE EXCEPTION 'El token de acceso ha expirado.';
    END IF;

    UPDATE public.voting_access_tokens
    SET used_at = CURRENT_TIMESTAMP
    WHERE token_hash = v_token_hash AND election_id = p_election_id;

    RETURN v_user_id;
END;
$$;

COMMIT;