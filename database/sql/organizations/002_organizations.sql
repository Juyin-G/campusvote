-- src/database/sql/organizations/002_organizations.sql


BEGIN;

-- TABLA: ORGANIZACIONES (TENANTS)

CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    name VARCHAR(200) NOT NULL,
    code VARCHAR(30) NOT NULL UNIQUE,
    org_type organization_type NOT NULL DEFAULT 'UNIVERSITY',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    logo VARCHAR(500) NULL,
    primary_color VARCHAR(7) NOT NULL DEFAULT '#0066CC',
    secondary_color VARCHAR(7) NOT NULL DEFAULT '#FFD700',

    country VARCHAR(100) NOT NULL DEFAULT 'Perú',
    timezone VARCHAR(50) NOT NULL DEFAULT 'America/Lima',
    onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
    onboarding_completed_at TIMESTAMPTZ NULL,

    CONSTRAINT chk_org_name_not_empty CHECK (length(trim(name)) > 0),
    CONSTRAINT chk_org_code_not_empty CHECK (length(trim(code)) > 0),

    CONSTRAINT chk_org_colors_hex_format CHECK (
        primary_color ~ '^#[0-9a-fA-F]{6}$'
        AND secondary_color ~ '^#[0-9a-fA-F]{6}$'
    ),

    -- Consistencia de onboarding bidireccional
    CONSTRAINT chk_org_onboarding_consistency CHECK (
        onboarding_completed = (onboarding_completed_at IS NOT NULL)
    )
);

-- ÍNDICES: ORGANIZATIONS

CREATE INDEX IF NOT EXISTS idx_organizations_type_active
    ON organizations (org_type)
    WHERE is_active = TRUE;

-- TRIGGER: ACTUALIZAR updated_at EN ORGANIZATIONS

DROP TRIGGER IF EXISTS trg_organizations_updated_at ON organizations;

CREATE TRIGGER trg_organizations_updated_at
BEFORE UPDATE ON organizations
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

COMMIT;