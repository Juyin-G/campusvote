BEGIN;

-- TABLA: VOTE SELECTIONS (DESNORMALIZACIÓN PARA CONTEO RÁPIDO)

CREATE TABLE IF NOT EXISTS vote_selections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    vote_id UUID NOT NULL REFERENCES votes(id) ON DELETE CASCADE,
    ballot_option_id UUID NOT NULL REFERENCES ballot_options(id) ON DELETE RESTRICT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_vote_selections_vote_option UNIQUE (vote_id, ballot_option_id)
);


-- ÍNDICES: VOTE_SELECTIONS

CREATE INDEX IF NOT EXISTS idx_vote_selections_vote
    ON vote_selections (vote_id);

CREATE INDEX IF NOT EXISTS idx_vote_selections_ballot_option
    ON vote_selections (ballot_option_id);

COMMIT;