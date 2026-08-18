BEGIN;

-- TABLA: OPCIONES DE BOLETA (BALLOT OPTIONS)

CREATE TABLE IF NOT EXISTS ballot_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    ballot_position_id UUID NOT NULL
        REFERENCES ballot_positions(id)
        ON DELETE CASCADE,

    option_type ballot_option_type NOT NULL DEFAULT 'CANDIDATE_LIST',

    candidate_list_id UUID NULL
        REFERENCES candidate_lists(id)
        ON DELETE CASCADE,

    label VARCHAR(120) NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_ballot_options_position_candidate
        UNIQUE (ballot_position_id, candidate_list_id),

    CONSTRAINT chk_ballot_options_label_not_empty
        CHECK (length(trim(label)) > 0),

    CONSTRAINT chk_ballot_options_candidate_list_required
        CHECK (
            option_type != 'CANDIDATE_LIST'
            OR candidate_list_id IS NOT NULL
        ),

    CONSTRAINT chk_ballot_options_no_candidate_for_blank_null
        CHECK (
            option_type = 'CANDIDATE_LIST'
            OR candidate_list_id IS NULL
        )
);

-- ÍNDICES: BALLOT_OPTIONS

-- Evita duplicar opciones BLANK o NULL en una misma posición
CREATE UNIQUE INDEX IF NOT EXISTS uq_ballot_options_position_type_special
    ON ballot_options (ballot_position_id, option_type)
    WHERE option_type IN ('BLANK', 'NULL');

CREATE INDEX IF NOT EXISTS idx_ballot_options_candidate_list_id
    ON ballot_options (candidate_list_id);

CREATE INDEX IF NOT EXISTS idx_ballot_options_type
    ON ballot_options (option_type);

-- TRIGGER: ACTUALIZAR updated_at EN BALLOT_OPTIONS

DROP TRIGGER IF EXISTS trg_ballot_options_updated_at ON ballot_options;

CREATE TRIGGER trg_ballot_options_updated_at
BEFORE UPDATE ON ballot_options
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

COMMIT;