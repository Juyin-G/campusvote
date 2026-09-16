-- 018_regions.sql
-- Regiones dentro de una organización.
-- Una región agrupa sedes (OrganizationSite) y permite administradores con
-- alcance regional (scopeLevel=REGION) sin duplicar filas por sede.
--
-- Estructura:
--   Organization ── Region ── OrganizationSite
--
-- Decisiones:
--   * region_id en organization_sites es NULL (las regiones son opcionales).
--   * FK a Organization con ON DELETE CASCADE: la región muere con su org.
--   * UNIQUE (organization_id, code) para evitar duplicados.

BEGIN;

CREATE TABLE IF NOT EXISTS regions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    code            VARCHAR(30) NOT NULL,
    name            VARCHAR(150) NOT NULL,
    description     TEXT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_regions_code_not_empty CHECK (length(trim(code)) > 0),
    CONSTRAINT chk_regions_name_not_empty CHECK (length(trim(name)) > 0),

    CONSTRAINT uq_regions_organization_code UNIQUE (organization_id, code)
);

CREATE INDEX IF NOT EXISTS idx_regions_organization ON regions (organization_id);

DROP TRIGGER IF EXISTS trg_regions_updated_at ON regions;
CREATE TRIGGER trg_regions_updated_at
BEFORE UPDATE ON regions
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;
