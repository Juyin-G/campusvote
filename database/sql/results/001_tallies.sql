BEGIN;

-- TABLA: TALLIES (CONTEO POR OPCIÓN)

CREATE TABLE IF NOT EXISTS tallies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    election_id UUID NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
    position_id UUID NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
    option_id UUID NOT NULL REFERENCES ballot_options(id) ON DELETE CASCADE,

    votes_count INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_tallies_election_position_option UNIQUE (election_id, position_id, option_id),
    CONSTRAINT chk_tallies_votes_non_negative CHECK (votes_count >= 0)
);

-- ÍNDICES: TALLIES
-- B-Tree implícito en UNIQUE cubre búsquedas por (election_id).
-- Se mantiene índice por position_id.

CREATE INDEX IF NOT EXISTS idx_tallies_position
    ON tallies (position_id);

-- TRIGGER: ACTUALIZAR updated_at EN TALLIES

DROP TRIGGER IF EXISTS trg_tallies_updated_at ON tallies;

CREATE TRIGGER trg_tallies_updated_at
BEFORE UPDATE ON tallies
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

COMMIT;