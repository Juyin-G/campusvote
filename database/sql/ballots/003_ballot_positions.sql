BEGIN;

-- TABLA: POSICIONES DE BOLETA (BALLOT POSITIONS)

CREATE TABLE IF NOT EXISTS ballot_positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    ballot_id UUID NOT NULL
        REFERENCES ballots(id)
        ON DELETE CASCADE,

    position_id UUID NOT NULL
        REFERENCES positions(id)
        ON DELETE CASCADE,

    order_index SMALLINT NOT NULL DEFAULT 1,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_ballot_positions_ballot_position UNIQUE (ballot_id, position_id),
    CONSTRAINT uq_ballot_positions_ballot_order UNIQUE (ballot_id, order_index),
    CONSTRAINT chk_ballot_positions_order_positive CHECK (order_index > 0)
);

-- ÍNDICES: BALLOT_POSITIONS

CREATE INDEX IF NOT EXISTS idx_ballot_positions_position_id
    ON ballot_positions (position_id);

-- TRIGGER: ACTUALIZAR updated_at EN BALLOT_POSITIONS

DROP TRIGGER IF EXISTS trg_ballot_positions_updated_at ON ballot_positions;

CREATE TRIGGER trg_ballot_positions_updated_at
BEFORE UPDATE ON ballot_positions
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

COMMIT;