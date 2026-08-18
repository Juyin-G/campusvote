BEGIN;

-- TABLA: LISTAS CANDIDATAS (CANDIDATE LISTS)

CREATE TABLE IF NOT EXISTS candidate_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    election_id UUID NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    acronym VARCHAR(20) NULL,
    motto VARCHAR(255) NULL,
    logo VARCHAR(500) NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_candidate_lists_election_name UNIQUE (election_id, name),
    -- Requerido para la FK compuesta en candidacies
    CONSTRAINT uq_candidate_lists_id_election UNIQUE (id, election_id),
    CONSTRAINT chk_candidate_lists_name_not_empty CHECK (length(trim(name)) > 0),
    CONSTRAINT chk_candidate_lists_acronym_not_empty CHECK (acronym IS NULL OR length(trim(acronym)) > 0),
    CONSTRAINT chk_candidate_lists_motto_not_empty CHECK (motto IS NULL OR length(trim(motto)) > 0)
);

-- TRIGGER: ACTUALIZAR updated_at EN CANDIDATE_LISTS

DROP TRIGGER IF EXISTS trg_candidate_lists_updated_at ON candidate_lists;

CREATE TRIGGER trg_candidate_lists_updated_at
BEFORE UPDATE ON candidate_lists
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

COMMIT;