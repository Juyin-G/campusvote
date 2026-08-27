-- // 002_programs.sql (Refactorizado)

BEGIN;

-- TABLA: PROGRAMAS ACADÉMICOS

CREATE TABLE IF NOT EXISTS programs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    faculty_id UUID NOT NULL REFERENCES faculties(id) ON DELETE RESTRICT,
    name VARCHAR(150) NOT NULL,
    code VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_programs_code UNIQUE (code),
    CONSTRAINT uq_programs_faculty_name UNIQUE (faculty_id, name),
    CONSTRAINT chk_programs_name_not_empty CHECK (length(trim(name)) > 0),
    CONSTRAINT chk_programs_code_not_empty CHECK (length(trim(code)) > 0)
);

-- ÍNDICES: PROGRAMS

CREATE INDEX IF NOT EXISTS idx_programs_faculty_id
    ON programs (faculty_id);

-- TRIGGER: ACTUALIZAR updated_at EN PROGRAMS

DROP TRIGGER IF EXISTS trg_programs_updated_at ON programs;

CREATE TRIGGER trg_programs_updated_at
BEFORE UPDATE ON programs
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

COMMIT;