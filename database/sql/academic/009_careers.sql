-- // 009_careers.sql

BEGIN;

-- TABLA: CARRERAS POR ORGANIZACIÓN
-- Cada organización (universidad/proyecto) define sus carreras identificadas por
-- un CÓDIGO CORTO (ej: "C-24", "DDS"). El código institucional del estudiante se
-- compara (prefijo) contra estos códigos para derivar automáticamente su carrera
-- (y opcionalmente ciclo) al registrarse.

CREATE TABLE IF NOT EXISTS careers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    code VARCHAR(20) NOT NULL,
    name VARCHAR(150) NOT NULL,
    cycle SMALLINT NULL CHECK (cycle BETWEEN 1 AND 20),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_careers_org_code UNIQUE (organization_id, code),
    CONSTRAINT chk_careers_name_not_empty CHECK (length(trim(name)) > 0),
    CONSTRAINT chk_careers_code_not_empty CHECK (length(trim(code)) > 0)
);

-- ÍNDICES: CAREERS

CREATE INDEX IF NOT EXISTS idx_careers_org_active
    ON careers (organization_id, is_active);

-- TRIGGER: ACTUALIZAR updated_at EN CAREERS

DROP TRIGGER IF EXISTS trg_careers_updated_at ON careers;

CREATE TRIGGER trg_careers_updated_at
BEFORE UPDATE ON careers
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

COMMIT;
