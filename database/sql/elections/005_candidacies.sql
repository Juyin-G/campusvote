-- 005_candidacies.sql (Actualizado)
BEGIN;

CREATE TABLE IF NOT EXISTS candidacies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    election_id UUID NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
    candidate_list_id UUID NOT NULL,
    position_id UUID NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    status candidacy_status_type NOT NULL DEFAULT 'PENDING', -- <-- COLUMNA AGREGADA
    order_index SMALLINT NOT NULL DEFAULT 1,
    is_principal BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_candidacies_candidate_list_election
        FOREIGN KEY (candidate_list_id, election_id)
        REFERENCES candidate_lists(id, election_id)
        ON DELETE CASCADE,

    CONSTRAINT fk_candidacies_position_election
        FOREIGN KEY (position_id, election_id)
        REFERENCES positions(id, election_id)
        ON DELETE CASCADE,

    CONSTRAINT uq_candidacies_election_user UNIQUE (election_id, user_id),
    CONSTRAINT uq_candidacies_list_position_order UNIQUE NULLS NOT DISTINCT (candidate_list_id, position_id, order_index),
    CONSTRAINT chk_candidacies_order_positive CHECK (order_index >= 1)
);

CREATE INDEX IF NOT EXISTS idx_candidacies_user_id ON candidacies (user_id);
CREATE INDEX IF NOT EXISTS idx_candidacies_candidate_list_id ON candidacies (candidate_list_id);
CREATE INDEX IF NOT EXISTS idx_candidacies_position_id ON candidacies (position_id) WHERE position_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_candidacies_updated_at ON candidacies;
CREATE TRIGGER trg_candidacies_updated_at
BEFORE UPDATE ON candidacies FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE UNIQUE INDEX IF NOT EXISTS uq_candidacies_one_principal_per_position
    ON candidacies (candidate_list_id, position_id)
    WHERE is_principal = TRUE AND position_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_candidacies_lock ON candidacies;
CREATE TRIGGER trg_candidacies_lock
BEFORE INSERT OR UPDATE OR DELETE ON candidacies
FOR EACH ROW EXECUTE FUNCTION enforce_election_immutability();

COMMIT;