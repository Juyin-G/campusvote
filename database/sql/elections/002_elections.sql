BEGIN;

-- TABLA: ELECCIONES (ELECTIONS)

CREATE TABLE IF NOT EXISTS elections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL DEFAULT '',

    process_type election_process_type NOT NULL DEFAULT 'VOTE',
    election_type election_scope_type NOT NULL,

    period_id UUID NOT NULL REFERENCES academic_periods(id) ON DELETE RESTRICT,
    faculty_id UUID NULL REFERENCES faculties(id) ON DELETE RESTRICT,
    program_id UUID NULL REFERENCES programs(id) ON DELETE RESTRICT,

    start_at TIMESTAMPTZ NOT NULL,
    end_at TIMESTAMPTZ NOT NULL,
    status election_status_type NOT NULL DEFAULT 'DRAFT',

    created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    form_structure JSONB NULL,
    is_anonymous_allowed BOOLEAN NOT NULL DEFAULT FALSE,

    CONSTRAINT chk_elections_dates CHECK (end_at > start_at),

    CONSTRAINT chk_elections_scope_integrity CHECK (
        (election_type = 'UNIVERSITY' AND faculty_id IS NULL AND program_id IS NULL) OR
        (election_type = 'FACULTY' AND faculty_id IS NOT NULL AND program_id IS NULL) OR
        (election_type = 'PROGRAM' AND faculty_id IS NOT NULL AND program_id IS NOT NULL)
    ),

    CONSTRAINT chk_elections_title_not_empty CHECK (length(trim(title)) > 0)
);

-- ÍNDICES: ELECTIONS

CREATE INDEX IF NOT EXISTS idx_elections_status
    ON elections (status);

CREATE INDEX IF NOT EXISTS idx_elections_period
    ON elections (period_id);

CREATE INDEX IF NOT EXISTS idx_elections_faculty
    ON elections (faculty_id)
    WHERE faculty_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_elections_program
    ON elections (program_id)
    WHERE program_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_elections_created_by
    ON elections (created_by);

-- Índice parcial compuesto para consultas rápidas de elecciones en votación
CREATE INDEX IF NOT EXISTS idx_elections_active_window
    ON elections (start_at, end_at)
    WHERE status = 'OPEN';

-- TRIGGER: ACTUALIZAR updated_at EN ELECTIONS

DROP TRIGGER IF EXISTS trg_elections_updated_at ON elections;

CREATE TRIGGER trg_elections_updated_at
BEFORE UPDATE ON elections
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

COMMIT;