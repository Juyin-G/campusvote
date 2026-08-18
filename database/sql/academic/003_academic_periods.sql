BEGIN;

-- TABLA: PERIODOS ACADÉMICOS

CREATE TABLE IF NOT EXISTS academic_periods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_academic_periods_dates_valid CHECK (end_date > start_date),
    CONSTRAINT chk_academic_periods_name_not_empty CHECK (length(trim(name)) > 0),

    -- Exclusión thread-safe nativa para evitar superposición de fechas
    -- en periodos activos
    CONSTRAINT ex_academic_periods_no_overlap
        EXCLUDE USING gist (
            daterange(start_date, end_date, '[]') WITH &&
        ) WHERE (is_active = TRUE)
);

-- ÍNDICES: ACADEMIC_PERIODS

CREATE INDEX IF NOT EXISTS idx_academic_periods_is_active
    ON academic_periods (is_active)
    WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_academic_periods_dates
    ON academic_periods (start_date, end_date);

-- TRIGGER: ACTUALIZAR updated_at EN ACADEMIC_PERIODS

DROP TRIGGER IF EXISTS trg_academic_periods_updated_at ON academic_periods;

CREATE TRIGGER trg_academic_periods_updated_at
BEFORE UPDATE ON academic_periods
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

COMMIT;