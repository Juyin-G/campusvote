-- // 001_faculties.sql (Refactorizado)

BEGIN;

-- TABLA: FACULTADES

CREATE TABLE IF NOT EXISTS faculties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    code VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_faculties_name UNIQUE (name),
    CONSTRAINT uq_faculties_code UNIQUE (code),
    CONSTRAINT chk_faculties_name_not_empty CHECK (length(trim(name)) > 0),
    CONSTRAINT chk_faculties_code_not_empty CHECK (length(trim(code)) > 0)
);

-- TRIGGER: ACTUALIZAR updated_at EN FACULTIES

DROP TRIGGER IF EXISTS trg_faculties_updated_at ON faculties;

CREATE TRIGGER trg_faculties_updated_at
BEFORE UPDATE ON faculties
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

COMMIT;