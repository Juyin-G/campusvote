-- // 004_ballot_options.sql (Refactorizado)

BEGIN;

CREATE TABLE IF NOT EXISTS ballot_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    ballot_position_id UUID NOT NULL,
    election_id UUID NOT NULL,

    option_type ballot_option_type NOT NULL DEFAULT 'CANDIDATE_LIST',

    candidate_list_id UUID NULL,

    label VARCHAR(120) NOT NULL,
    order_index SMALLINT NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- FKs compuestas: Aíslan la lista de candidatos dentro de la misma elección de la posición
    CONSTRAINT fk_ballot_options_position_election
        FOREIGN KEY (ballot_position_id, election_id)
        REFERENCES ballot_positions(id, election_id)
        ON DELETE CASCADE,

    CONSTRAINT fk_ballot_options_candidate_list_election
        FOREIGN KEY (candidate_list_id, election_id)
        REFERENCES candidate_lists(id, election_id)
        ON DELETE CASCADE,

    CONSTRAINT uq_ballot_options_position_candidate
        UNIQUE (ballot_position_id, candidate_list_id),

    CONSTRAINT uq_ballot_options_position_order
        UNIQUE (ballot_position_id, order_index),

    CONSTRAINT chk_ballot_options_order_positive
        CHECK (order_index > 0),

    CONSTRAINT chk_ballot_options_label_not_empty
        CHECK (length(trim(label)) > 0),

    CONSTRAINT chk_ballot_options_candidate_list_logic CHECK (
        (option_type = 'CANDIDATE_LIST' AND candidate_list_id IS NOT NULL) OR
        (option_type != 'CANDIDATE_LIST' AND candidate_list_id IS NULL)
    )
);

-- Corrección del sintaxis bug: 'VOID' en lugar de 'NULL'
CREATE UNIQUE INDEX IF NOT EXISTS uq_ballot_options_position_type_special
    ON ballot_options (ballot_position_id, option_type)
    WHERE option_type IN ('BLANK', 'VOID');

CREATE INDEX IF NOT EXISTS idx_ballot_options_candidate_list_id
    ON ballot_options (candidate_list_id);

DROP TRIGGER IF EXISTS trg_ballot_options_updated_at ON ballot_options;
CREATE TRIGGER trg_ballot_options_updated_at
BEFORE UPDATE ON ballot_options
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

COMMIT;