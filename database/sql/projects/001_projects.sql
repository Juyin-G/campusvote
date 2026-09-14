-- projects/001_projects.sql
-- Proyectos de feria académica y sus participantes.
-- Entidad deliberadamente separada de elections/candidacies: una feria NO se
-- modela como proceso electoral. EXPOSITOR no es un rol global del sistema,
-- se expresa como participación en project_members.

BEGIN;

-- ENUM: ESTADO DE REVISIÓN DE UN PROYECTO
DO $$ BEGIN
    CREATE TYPE project_status AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ENUM: ROL DE UN PARTICIPANTE DENTRO DEL PROYECTO
DO $$ BEGIN
    CREATE TYPE project_member_role AS ENUM ('EXPOSITOR', 'COLLABORATOR', 'ADVISOR');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- TABLA: PROJECTS
-- El propietario se identifica con created_by (única fuente de verdad).
-- organization_id es el tenant y ancla la regla de pertenencia de los miembros.
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,

    name VARCHAR(200) NOT NULL,
    description TEXT NULL,
    logo_url VARCHAR(500) NULL,
    cover_url VARCHAR(500) NULL,
    project_url VARCHAR(1000) NULL,
    status project_status NOT NULL DEFAULT 'DRAFT',

    reviewed_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    review_notes TEXT NULL,
    reviewed_at TIMESTAMPTZ NULL,
    submitted_at TIMESTAMPTZ NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_projects_name_not_empty CHECK (length(trim(name)) > 0),
    -- Consistencia: un proyecto APPROVED/REJECTED siempre tiene reviewed_at.
    CONSTRAINT chk_projects_review_consistency CHECK (
        (status IN ('APPROVED', 'REJECTED')) = (reviewed_at IS NOT NULL)
    )
);

-- ÍNDICES: PROJECTS

CREATE INDEX IF NOT EXISTS idx_projects_organization
    ON projects (organization_id);
CREATE INDEX IF NOT EXISTS idx_projects_created_by
    ON projects (created_by);
CREATE INDEX IF NOT EXISTS idx_projects_status
    ON projects (status);
CREATE INDEX IF NOT EXISTS idx_projects_organization_status
    ON projects (organization_id, status);

-- TRIGGER: ACTUALIZAR updated_at EN PROJECTS

DROP TRIGGER IF EXISTS trg_projects_updated_at ON projects;

CREATE TRIGGER trg_projects_updated_at
BEFORE UPDATE ON projects
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- TABLA: PROJECT_MEMBERS (PARTICIPANTES)
-- Many-to-many proyecto<->usuario. UNIQUE impide duplicar a un integrante.
CREATE TABLE IF NOT EXISTS project_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role project_member_role NOT NULL DEFAULT 'EXPOSITOR',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_project_members_project_user UNIQUE (project_id, user_id)
);

-- ÍNDICES: PROJECT_MEMBERS

CREATE INDEX IF NOT EXISTS idx_project_members_user
    ON project_members (user_id);

COMMIT;
