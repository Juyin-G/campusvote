BEGIN;

-- TABLA: REGLAS DE ELECCIÓN (ELECTION RULES)

CREATE TABLE IF NOT EXISTS election_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    election_id UUID NOT NULL UNIQUE REFERENCES elections(id) ON DELETE CASCADE,

    min_turnout_percentage NUMERIC(5, 2) NOT NULL DEFAULT 0,
    allow_blank_vote BOOLEAN NOT NULL DEFAULT TRUE,
    allow_null_vote BOOLEAN NOT NULL DEFAULT TRUE,
    max_positions_per_ballot SMALLINT NOT NULL DEFAULT 1,
    requires_2fa BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_election_rules_turnout CHECK (min_turnout_percentage >= 0 AND min_turnout_percentage <= 100),
    CONSTRAINT chk_election_rules_max_positions CHECK (max_positions_per_ballot >= 1)
);

-- TRIGGER: ACTUALIZAR updated_at EN ELECTION_RULES

DROP TRIGGER IF EXISTS trg_election_rules_updated_at ON election_rules;

CREATE TRIGGER trg_election_rules_updated_at
BEFORE UPDATE ON election_rules
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

COMMIT;