-- // 004_candidate_lists.sql (Refactorizado)

BEGIN;

CREATE TABLE IF NOT EXISTS candidate_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    election_id UUID NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    acronym VARCHAR(20) NULL,
    motto VARCHAR(255) NULL,
    logo VARCHAR(500) NULL,
    description TEXT NULL,
    image_url VARCHAR(1000) NULL,
    category VARCHAR(80) NULL,
    tags JSONB NOT NULL DEFAULT '[]'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_candidate_lists_election_name UNIQUE (election_id, name),
    CONSTRAINT uq_candidate_lists_election_acronym UNIQUE (election_id, acronym),
    CONSTRAINT uq_candidate_lists_id_election UNIQUE (id, election_id),
    CONSTRAINT chk_candidate_lists_name_not_empty CHECK (length(trim(name)) > 0),
    CONSTRAINT chk_candidate_lists_acronym_not_empty CHECK (acronym IS NULL OR length(trim(acronym)) > 0),
    CONSTRAINT chk_candidate_lists_motto_not_empty CHECK (motto IS NULL OR length(trim(motto)) > 0),
    CONSTRAINT chk_candidate_lists_logo_not_empty CHECK (logo IS NULL OR length(trim(logo)) > 0),
    CONSTRAINT chk_candidate_lists_description_not_empty CHECK (description IS NULL OR length(trim(description)) > 0),
    CONSTRAINT chk_candidate_lists_image_url_not_empty CHECK (image_url IS NULL OR length(trim(image_url)) > 0),
    CONSTRAINT chk_candidate_lists_category_not_empty CHECK (category IS NULL OR length(trim(category)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_candidate_lists_election_id ON candidate_lists (election_id);
CREATE INDEX IF NOT EXISTS idx_candidate_lists_category ON candidate_lists (category);

DROP TRIGGER IF EXISTS trg_candidate_lists_updated_at ON candidate_lists;
CREATE TRIGGER trg_candidate_lists_updated_at
BEFORE UPDATE ON candidate_lists FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_candidate_lists_lock ON candidate_lists;
CREATE TRIGGER trg_candidate_lists_lock
BEFORE INSERT OR UPDATE OR DELETE ON candidate_lists
FOR EACH ROW EXECUTE FUNCTION enforce_election_immutability();

COMMIT;