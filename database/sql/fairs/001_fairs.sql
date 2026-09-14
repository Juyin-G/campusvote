-- fairs/001_fairs.sql
-- Feria/evento académico (tenant: una feria pertenece a UNA organización).
-- Estructura jerárquica objetivo:
--   Organization ─➤ Fair ─➤ Project ─➤ ProjectMember

BEGIN;

-- ENUM: ESTADO DEL CICLO DE VIDA DE UNA FERIA
-- Independiente de project_status (un proyecto dentro de la feria pasa por
-- DRAFT/SUBMITTED/APPROVED/REJECTED sin mezclarse con estos estados).
DO $$ BEGIN
    CREATE TYPE fair_status AS ENUM ('DRAFT', 'OPEN', 'CLOSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- TABLA: FAIRS
CREATE TABLE IF NOT EXISTS fairs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,

    name VARCHAR(200) NOT NULL,
    description TEXT NULL,
    status fair_status NOT NULL DEFAULT 'DRAFT',
    starts_at TIMESTAMPTZ NULL,
    ends_at TIMESTAMPTZ NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_fairs_name_not_empty CHECK (length(trim(name)) > 0)
);

-- ÍNDICES: FAIRS

CREATE INDEX IF NOT EXISTS idx_fairs_organization
    ON fairs (organization_id);
CREATE INDEX IF NOT EXISTS idx_fairs_status
    ON fairs (status);

-- TRIGGER: ACTUALIZAR updated_at EN FAIRS

DROP TRIGGER IF EXISTS trg_fairs_updated_at ON fairs;

CREATE TRIGGER trg_fairs_updated_at
BEFORE UPDATE ON fairs
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

COMMIT;