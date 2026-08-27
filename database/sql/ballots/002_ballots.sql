-- // 002_ballots.sql (Refactorizado)

BEGIN;

CREATE TABLE IF NOT EXISTS ballots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    election_id UUID NOT NULL
        REFERENCES elections(id)
        ON DELETE CASCADE,

    version INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_ballots_election_version UNIQUE (election_id, version),
    -- Clave compuesta necesaria para amarrar la frontera de la elección aguas abajo
    CONSTRAINT uq_ballots_id_election UNIQUE (id, election_id),
    CONSTRAINT chk_ballots_version_positive CHECK (version > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_ballots_single_active
    ON ballots (election_id)
    WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_ballots_generated_at
    ON ballots (generated_at DESC);

DROP TRIGGER IF EXISTS trg_ballots_updated_at ON ballots;
CREATE TRIGGER trg_ballots_updated_at
BEFORE UPDATE ON ballots
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

COMMIT;