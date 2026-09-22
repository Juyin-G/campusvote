-- 021_user_site_assignments.sql
-- Asignaciones de ADMIN SITE a sedes concretas (N:M).
-- Un ADMIN SITE puede administrar una o varias sedes de su organización.
--
-- Estructura:
--   User (ADMIN, scopeLevel=SITE) ── UserSiteAssignment ── OrganizationSite
--
-- Reglas:
--   * UNIQUE (user_id, site_id) — un ADMIN no puede tener la misma sede dos veces.
--   * granted_by auditable.
--   * expires_at NULLABLE: una asignación sin expiración es permanente hasta
--     revocación manual.
--   * Al eliminarse el User o la OrganizationSite, la asignación se elimina
--     (CASCADE).

BEGIN;

CREATE TABLE IF NOT EXISTS user_site_assignments (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    site_id     UUID NOT NULL REFERENCES organization_sites(id) ON DELETE CASCADE,
    granted_by  UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    granted_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at  TIMESTAMPTZ NULL,

    CONSTRAINT uq_user_site_assignments UNIQUE (user_id, site_id)
);

CREATE INDEX IF NOT EXISTS idx_usa_user ON user_site_assignments (user_id);
CREATE INDEX IF NOT EXISTS idx_usa_site ON user_site_assignments (site_id);

DROP TRIGGER IF EXISTS trg_usa_updated_at ON user_site_assignments;
CREATE TRIGGER trg_usa_updated_at
BEFORE UPDATE ON user_site_assignments
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;
