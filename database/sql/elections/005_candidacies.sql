BEGIN;

-- TABLA: CANDIDATURAS (CANDIDACIES)

CREATE TABLE IF NOT EXISTS candidacies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    election_id UUID NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
    candidate_list_id UUID NOT NULL,
    position_id UUID NULL REFERENCES positions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    order_index SMALLINT NOT NULL DEFAULT 1,
    is_principal BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Valida que la lista pertenezca exactamente a la misma elección
    CONSTRAINT fk_candidacies_candidate_list_election
        FOREIGN KEY (candidate_list_id, election_id)
        REFERENCES candidate_lists(id, election_id)
        ON DELETE CASCADE,

    -- ATÓMICO: Un usuario solo puede pertenecer a UNA lista por elección
    CONSTRAINT uq_candidacies_election_user UNIQUE (election_id, user_id),

    -- PostgreSQL 18: Un usuario no repite cargo aunque position_id sea NULL
    CONSTRAINT uq_candidacies_position_user UNIQUE NULLS NOT DISTINCT (position_id, user_id),
    CONSTRAINT chk_candidacies_order_positive CHECK (order_index >= 1)
);

-- ÍNDICES: CANDIDACIES

CREATE INDEX IF NOT EXISTS idx_candidacies_user_id
    ON candidacies (user_id);

CREATE INDEX IF NOT EXISTS idx_candidacies_candidate_list_id
    ON candidacies (candidate_list_id);

-- TRIGGER: ACTUALIZAR updated_at EN CANDIDACIES

DROP TRIGGER IF EXISTS trg_candidacies_updated_at ON candidacies;

CREATE TRIGGER trg_candidacies_updated_at
BEFORE UPDATE ON candidacies
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

COMMIT;