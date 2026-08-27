--004_start_session.sql (Refactorizado)

BEGIN;

CREATE OR REPLACE FUNCTION start_voting_session(
    p_election_id UUID,
    p_voter_id UUID,
    p_ip_address INET,
    p_user_agent TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_session_id UUID;
    v_election_status election_status_type;
    v_can_vote BOOLEAN;
    v_period_id UUID;
BEGIN
    -- Limpieza de sesiones huérfanas (> 15 min)
    UPDATE voting_sessions
    SET completed_at = CURRENT_TIMESTAMP, is_successful = FALSE
    WHERE election_id = p_election_id 
      AND voter_id = p_voter_id
      AND completed_at IS NULL 
      AND started_at < (CURRENT_TIMESTAMP - INTERVAL '15 minutes');

    SELECT status, period_id INTO v_election_status, v_period_id 
    FROM elections WHERE id = p_election_id;

    IF v_election_status IS NULL THEN 
        RAISE EXCEPTION 'La elección especificada no existe.'; 
    END IF;
    
    IF v_election_status != 'OPEN' THEN 
        RAISE EXCEPTION 'La elección no está abierta. Estado: %', v_election_status; 
    END IF;

    SELECT can_user_vote(p_voter_id, v_period_id) INTO v_can_vote;
    IF v_can_vote = FALSE THEN 
        RAISE EXCEPTION 'El usuario no es elegible para votar en esta elección.'; 
    END IF;

    IF EXISTS (SELECT 1 FROM votes WHERE election_id = p_election_id AND voter_id = p_voter_id) THEN
        RAISE EXCEPTION 'El usuario ya emitió su voto en esta elección.';
    END IF;

    INSERT INTO voting_sessions (election_id, voter_id, ip_address, user_agent)
    VALUES (p_election_id, p_voter_id, p_ip_address, p_user_agent)
    RETURNING id INTO v_session_id;

    RETURN v_session_id;
EXCEPTION
    WHEN unique_violation THEN
        RAISE EXCEPTION 'Ya existe una sesión de votación activa en curso para este usuario.';
END;
$$;

REVOKE ALL ON FUNCTION start_voting_session(UUID, UUID, INET, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION start_voting_session(UUID, UUID, INET, TEXT) TO app_user;

COMMIT;