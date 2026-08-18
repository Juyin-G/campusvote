BEGIN;

-- FUNCIÓN MAESTRA: INICIAR SESIÓN DE VOTACIÓN

-- Valida estado de elección, elegibilidad del votante,
-- y que no haya votado previamente.
-- Protegida por el índice único parcial uq_voting_sessions_active_user.

CREATE OR REPLACE FUNCTION start_voting_session(
    p_election_id UUID,
    p_voter_id UUID,
    p_ip_address INET,
    p_user_agent TEXT
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
    v_session_id UUID;
    v_election_status election_status_type;
    v_can_vote BOOLEAN;
BEGIN
    SELECT status INTO v_election_status FROM elections WHERE id = p_election_id;

    IF v_election_status != 'OPEN' THEN
        RAISE EXCEPTION 'La elección no está abierta. Estado: %', v_election_status;
    END IF;

    SELECT can_user_vote(p_voter_id, (SELECT period_id FROM elections WHERE id = p_election_id))
    INTO v_can_vote;

    IF v_can_vote = FALSE THEN
        RAISE EXCEPTION 'El usuario no es elegible para votar en esta elección.';
    END IF;

    IF EXISTS (SELECT 1 FROM votes WHERE election_id = p_election_id AND voter_id = p_voter_id) THEN
        RAISE EXCEPTION 'El usuario ya emitió su voto en esta elección.';
    END IF;

    INSERT INTO voting_sessions (
        election_id,
        voter_id,
        ip_address,
        user_agent
    )
    VALUES (
        p_election_id,
        p_voter_id,
        p_ip_address,
        p_user_agent
    )
    RETURNING id INTO v_session_id;

    RETURN v_session_id;
EXCEPTION
    WHEN unique_violation THEN
        RAISE EXCEPTION 'Ya existe una sesión de votación activa en curso para este usuario.';
END;
$$;

COMMIT;