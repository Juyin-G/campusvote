BEGIN;

-- TABLA: PADRÓN ELECTORAL (VOTER REGISTRY)

CREATE TABLE IF NOT EXISTS voter_registries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    program_id UUID NOT NULL REFERENCES programs(id) ON DELETE RESTRICT,
    period_id UUID NOT NULL REFERENCES academic_periods(id) ON DELETE RESTRICT,
    semester SMALLINT NOT NULL,
    is_eligible BOOLEAN NOT NULL DEFAULT TRUE,
    eligibility_reason TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_voter_registries_user_period UNIQUE (user_id, period_id),
    CONSTRAINT chk_voter_registries_semester_valid
        CHECK (semester >= 1 AND semester <= 12),
    CONSTRAINT chk_voter_registries_eligibility_reason CHECK (
        is_eligible = TRUE
        OR (
            is_eligible = FALSE
            AND eligibility_reason IS NOT NULL
            AND length(trim(eligibility_reason)) > 0
        )
    )
);

-- ÍNDICES: VOTER_REGISTRIES

CREATE INDEX IF NOT EXISTS idx_voter_registries_program_id
    ON voter_registries (program_id);

CREATE INDEX IF NOT EXISTS idx_voter_registries_period_id
    ON voter_registries (period_id);

CREATE INDEX IF NOT EXISTS idx_voter_registries_period_eligible
    ON voter_registries (period_id, is_eligible)
    WHERE is_eligible = TRUE;

CREATE INDEX IF NOT EXISTS idx_voter_registries_program_period
    ON voter_registries (program_id, period_id);

-- TRIGGER: ACTUALIZAR updated_at EN VOTER_REGISTRIES

DROP TRIGGER IF EXISTS trg_voter_registries_updated_at ON voter_registries;

CREATE TRIGGER trg_voter_registries_updated_at
BEFORE UPDATE ON voter_registries
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

COMMIT;