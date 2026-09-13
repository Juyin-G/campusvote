-- fairs/006_fair_site.sql
-- Vincula una feria con su SEDE (organización_sites). El contexto físico de
-- la feria queda opcional (site_id NULL) y validado en service contra la MISMA
-- organización (fair.organization_id === site.organization_id).
--
-- Decisiones:
--   * ON DELETE SET NULL: eliminar una sede NO elimina la feria (la feria
--     conserva su configuración; el contexto físico queda desasignado).
--   * Requiere organizations/006_organization_sites.sql aplicado antes.

BEGIN;

ALTER TABLE fairs ADD COLUMN IF NOT EXISTS site_id UUID;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_fairs_site') THEN
        ALTER TABLE fairs
            ADD CONSTRAINT fk_fairs_site
            FOREIGN KEY (site_id) REFERENCES organization_sites(id)
            ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_fairs_site
    ON fairs (site_id);

COMMIT;