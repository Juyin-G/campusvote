-- organizations/006_organization_sites.sql
-- Sedes de una organización (contexto físico opcional de ferias).
--
-- Estructura:
--   Organization ── OrganizationSite ── Fair (fairs.site_id)
--
-- Decisiones:
--   * ON DELETE CASCADE: las sedes se eliminan con su organización.
--   * name obligatorio (CHECK); address/city opcionales.
--   * latitude/longitude opcionales con rango numérico (CHECK [-90,90] y
--     [-180,180]). NO se implementan mapas/GPS: solo se persisten coordenadas.
--   * fairs.site_id (fairs/006) → ON DELETE SET NULL.

BEGIN;

CREATE TABLE IF NOT EXISTS organization_sites (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    name      VARCHAR(200) NOT NULL,
    address   VARCHAR(500) NULL,
    city      VARCHAR(100) NULL,
    latitude  NUMERIC(9,6) NULL,
    longitude NUMERIC(9,6) NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_organization_sites_name_not_empty CHECK (length(trim(name)) > 0),
    CONSTRAINT chk_organization_sites_latitude CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90)),
    CONSTRAINT chk_organization_sites_longitude CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180))
);

CREATE INDEX IF NOT EXISTS idx_organization_sites_organization
    ON organization_sites (organization_id);

-- TRIGGER: ACTUALIZAR updated_at
DROP TRIGGER IF EXISTS trg_organization_sites_updated_at ON organization_sites;
CREATE TRIGGER trg_organization_sites_updated_at
BEFORE UPDATE ON organization_sites
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;