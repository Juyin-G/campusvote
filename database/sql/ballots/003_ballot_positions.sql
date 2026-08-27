-- // 003_ballot_positions.sql (Refactorizado)

BEGIN;

CREATE TABLE IF NOT EXISTS ballot_positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    ballot_id UUID NOT NULL,
    position_id UUID NOT NULL,
    election_id UUID NOT NULL,

    order_index SMALLINT NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- FKs compuestas: Garantizan que el cargo pertenece a la MISMA elección que la boleta
    CONSTRAINT fk_ballot_positions_ballot_election
        FOREIGN KEY (ballot_id, election_id)
        REFERENCES ballots(id, election_id)
        ON DELETE CASCADE,

    CONSTRAINT fk_ballot_positions_position_election
        FOREIGN KEY (position_id, election_id)
        REFERENCES positions(id, election_id)
        ON DELETE CASCADE,

    CONSTRAINT uq_ballot_positions_ballot_position UNIQUE (ballot_id, position_id),
    CONSTRAINT uq_ballot_positions_ballot_order UNIQUE (ballot_id, order_index),
    -- Clave compuesta para propagar aislamiento hacia ballot_options
    CONSTRAINT uq_ballot_positions_id_election UNIQUE (id, election_id),
    CONSTRAINT chk_ballot_positions_order_positive CHECK (order_index > 0)
);

CREATE INDEX IF NOT EXISTS idx_ballot_positions_position_id
    ON ballot_positions (position_id);

DROP TRIGGER IF EXISTS trg_ballot_positions_updated_at ON ballot_positions;
CREATE TRIGGER trg_ballot_positions_updated_at
BEFORE UPDATE ON ballot_positions
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

COMMIT;