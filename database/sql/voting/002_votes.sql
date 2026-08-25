BEGIN;

-- TABLA: VOTES (VOTOS CIFRADOS)

CREATE TABLE IF NOT EXISTS votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    election_id UUID NOT NULL REFERENCES elections(id) ON DELETE RESTRICT,
    voter_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    session_id UUID NOT NULL UNIQUE REFERENCES voting_sessions(id) ON DELETE RESTRICT,

    cast_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    receipt_code VARCHAR(64) NOT NULL UNIQUE,
    encrypted_payload TEXT NOT NULL,
    payload_hash VARCHAR(128) NOT NULL,

    CONSTRAINT uq_votes_election_voter UNIQUE (election_id, voter_id),
    CONSTRAINT chk_votes_receipt_code_length CHECK (length(trim(receipt_code)) >= 32),
    CONSTRAINT chk_votes_payload_not_empty CHECK (length(trim(encrypted_payload)) > 0),
    CONSTRAINT chk_votes_payload_hash_length CHECK (length(payload_hash) = 128)
);

-- REFUERZO DE COLUMNAS (Por si la tabla ya existía de ejecuciones previas)
ALTER TABLE votes ADD COLUMN IF NOT EXISTS election_id UUID;
ALTER TABLE votes ADD COLUMN IF NOT EXISTS voter_id UUID;
ALTER TABLE votes ADD COLUMN IF NOT EXISTS session_id UUID;
ALTER TABLE votes ADD COLUMN IF NOT EXISTS cast_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE votes ADD COLUMN IF NOT EXISTS receipt_code VARCHAR(64);
ALTER TABLE votes ADD COLUMN IF NOT EXISTS encrypted_payload TEXT;
ALTER TABLE votes ADD COLUMN IF NOT EXISTS payload_hash VARCHAR(128);

-- ÍNDICES: VOTES

CREATE INDEX IF NOT EXISTS idx_votes_election
    ON votes (election_id);

CREATE INDEX IF NOT EXISTS idx_votes_voter
    ON votes (voter_id);

CREATE INDEX IF NOT EXISTS idx_votes_payload_hash
    ON votes (payload_hash);

CREATE INDEX IF NOT EXISTS idx_votes_cast_at
    ON votes (cast_at DESC);

-- FUNCIÓN: VALIDAR INTEGRIDAD DEL VOTO

CREATE OR REPLACE FUNCTION validate_vote_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_session RECORD;
    v_election RECORD;
    v_now TIMESTAMPTZ := CURRENT_TIMESTAMP;
BEGIN
    SELECT * INTO v_session
    FROM voting_sessions
    WHERE id = NEW.session_id;

    IF v_session.is_successful = FALSE OR v_session.completed_at IS NULL THEN
        RAISE EXCEPTION 'No se puede registrar un voto de una sesión no completada o no exitosa.';
    END IF;

    IF v_session.voter_id != NEW.voter_id OR v_session.election_id != NEW.election_id THEN
        RAISE EXCEPTION 'La sesión no corresponde al votante o elección del voto.';
    END IF;

    SELECT status, start_at, end_at INTO v_election
    FROM elections
    WHERE id = NEW.election_id;

    IF v_election.status != 'OPEN' THEN
        RAISE EXCEPTION 'La elección no está abierta para votar. Estado: %', v_election.status;
    END IF;

    IF v_now < v_election.start_at OR v_now > v_election.end_at THEN
        RAISE EXCEPTION 'Fuera del rango temporal permitido para esta elección.';
    END IF;

    IF NEW.cast_at < v_session.started_at OR NEW.cast_at > v_session.completed_at THEN
        RAISE EXCEPTION 'El timestamp del voto está fuera del rango de duración de la sesión.';
    END IF;

    RETURN NEW;
END;
$$;

-- TRIGGER: VALIDAR INTEGRIDAD EN INSERT

DROP TRIGGER IF EXISTS trg_validate_vote_integrity ON votes;

CREATE TRIGGER trg_validate_vote_integrity
BEFORE INSERT ON votes
FOR EACH ROW
EXECUTE FUNCTION validate_vote_integrity();

COMMIT;