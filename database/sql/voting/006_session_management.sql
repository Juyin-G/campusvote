-- sql/voting/006_session_management.sql


BEGIN;

CREATE OR REPLACE FUNCTION close_failed_session(
    p_session_id UUID,
    p_voter_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_session RECORD;
BEGIN
    SELECT * INTO v_session
    FROM voting_sessions
    WHERE id = p_session_id
      AND voter_id = p_voter_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    IF v_session.is_successful = TRUE THEN
        RAISE EXCEPTION 'No se puede cancelar una sesión que ya fue completada exitosamente.';
    END IF;

    IF v_session.completed_at IS NOT NULL THEN
        RETURN FALSE;
    END IF;

    UPDATE voting_sessions
    SET
        is_successful = FALSE,
        completed_at = CURRENT_TIMESTAMP
    WHERE id = p_session_id;

    RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION close_failed_session(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION close_failed_session(UUID, UUID) TO app_user;


CREATE OR REPLACE FUNCTION cleanup_orphan_sessions(
    p_timeout_minutes INT DEFAULT 30
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_closed_count INTEGER;
BEGIN
    UPDATE voting_sessions
    SET
        is_successful = FALSE,
        completed_at = CURRENT_TIMESTAMP
    WHERE completed_at IS NULL
      AND is_successful = FALSE
      AND started_at < (CURRENT_TIMESTAMP - make_interval(mins => p_timeout_minutes));

    GET DIAGNOSTICS v_closed_count = ROW_COUNT;

    RETURN v_closed_count;
END;
$$;

REVOKE ALL ON FUNCTION cleanup_orphan_sessions(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cleanup_orphan_sessions(INT) TO app_user;

COMMIT;