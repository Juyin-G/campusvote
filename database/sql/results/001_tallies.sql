-- src/database/sql/results/001_tallies.sql

BEGIN;

-- PRERREQ: Asegurar restricción única compuesta en ballot_options para FK estricta
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_ballot_options_id_election'
    ) THEN
        ALTER TABLE ballot_options ADD CONSTRAINT uq_ballot_options_id_election UNIQUE (id, election_id);
    END IF;
END $$;

-- TABLA: TALLIES (CONTEO POR OPCIÓN CON FK COMPUESTAS DE AISLAMIENTO)

CREATE TABLE IF NOT EXISTS tallies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    election_id UUID NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
    position_id UUID NOT NULL,
    option_id UUID NOT NULL,

    votes_count INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_tallies_election_position_option UNIQUE (election_id, position_id, option_id),
    CONSTRAINT chk_tallies_votes_non_negative CHECK (votes_count >= 0),

    CONSTRAINT fk_tallies_position_election
        FOREIGN KEY (position_id, election_id) REFERENCES positions(id, election_id) ON DELETE CASCADE,
    CONSTRAINT fk_tallies_option_election
        FOREIGN KEY (option_id, election_id) REFERENCES ballot_options(id, election_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tallies_position ON tallies (position_id);

DROP TRIGGER IF EXISTS trg_tallies_updated_at ON tallies;
CREATE TRIGGER trg_tallies_updated_at
BEFORE UPDATE ON tallies
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

COMMIT;