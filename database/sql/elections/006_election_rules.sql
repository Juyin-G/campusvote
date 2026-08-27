-- 006_election_rules.sql (Refactorizado)

BEGIN;

CREATE TABLE IF NOT EXISTS election_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    election_id UUID NOT NULL UNIQUE REFERENCES elections(id) ON DELETE CASCADE,

    min_turnout_percentage NUMERIC(5, 2) NOT NULL DEFAULT 0,
    allow_blank_vote BOOLEAN NOT NULL DEFAULT TRUE,
    allow_null_vote BOOLEAN NOT NULL DEFAULT TRUE,
    max_votes_per_position SMALLINT NOT NULL DEFAULT 1, 
    requires_2fa BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_election_rules_turnout CHECK (min_turnout_percentage >= 0 AND min_turnout_percentage <= 100),
    CONSTRAINT chk_election_rules_max_votes CHECK (max_votes_per_position >= 1)
);

DROP TRIGGER IF EXISTS trg_election_rules_updated_at ON election_rules;
CREATE TRIGGER trg_election_rules_updated_at
BEFORE UPDATE ON election_rules FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Trigger movido aquí (después de la creación de la tabla)
DROP TRIGGER IF EXISTS trg_election_rules_lock ON election_rules;
CREATE TRIGGER trg_election_rules_lock
BEFORE INSERT OR UPDATE OR DELETE ON election_rules
FOR EACH ROW EXECUTE FUNCTION enforce_election_immutability();

COMMIT;