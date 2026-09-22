-- 019_site_region.sql
-- Asocia cada sede con una región (opcional).
-- Una sede sin region_id pertenece a toda la organización (modo legacy).
--
-- Decisiones:
--   * region_id opcional: no rompemos ferias existentes que no tienen región.
--   * FK a Region con ON DELETE SET NULL: si se elimina la región, la sede
--     sobrevive y queda como "sin región" (la org puede asignarla luego).
--   * La pertenencia región→org ya está garantizada por FK regions.organization_id
--     (la región solo puede ser de la org correcta); no se requiere CHECK
--     cruzada aquí porque regions.organization_id es la única fuente.

BEGIN;

ALTER TABLE organization_sites
    ADD COLUMN IF NOT EXISTS region_id UUID;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_organization_sites_region') THEN
        ALTER TABLE organization_sites
            ADD CONSTRAINT fk_organization_sites_region
            FOREIGN KEY (region_id) REFERENCES regions(id)
            ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_organization_sites_region
    ON organization_sites (region_id);

COMMIT;
