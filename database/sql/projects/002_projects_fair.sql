-- projects/002_projects_fair.sql
-- Vincula PROJECT con su FERIA y hace que la feria sea la fuente de verdad
-- de la organización del proyecto.
--
-- Estrategia de migración de proyectos EXISTENTES (no destructiva):
--   1. Se añade projects.fair_id NULL (columna nueva).
--   2. Se reemplaza la FK directa projects.organization_id -> organizations
--      por una FK COMPUESTA projects(fair_id, organization_id) ->
--      fairs(id, organization_id). Il efecto a nivel de BD:
--        * la organización del proyecto SIEMPRE es la de su feria (una única
--          fuente de verdad), y
--        * un proyecto NO puede moverse entre organizaciones.
--   3. NO se inventan ferias: si existen proyectos sin feria, fair_id queda
--      NULL y NO se aplica NOT NULL (compatibilidad con datos legados). El
--      backend exige fair_id en toda escritura y el operador debe asignar una
--      feria real antes de continuar con esos proyectos. Si no hay proyectos
--      huérfanos, fair_id se activa como NOT NULL (integridad total).
--
-- Requiere fairs/001_fairs.sql aplicado previamente.

BEGIN;

-- 1. NUEVA COLUMNA fair_id (nullable mientras haya datos legados)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS fair_id UUID;

-- ÍNDICE para joins y filtros por feria
CREATE INDEX IF NOT EXISTS idx_projects_fair
    ON projects (fair_id);

-- 2. UNIQUE para la FK compuesta (Postgres exige una restricción única
--    exacta sobre las columnas referenciadas)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_fairs_id_organization') THEN
        ALTER TABLE fairs ADD CONSTRAINT uq_fairs_id_organization UNIQUE (id, organization_id);
    END IF;
END $$;

-- 3. Reemplazar la FK directa por la FK compuesta de integridad.
--    Se conserva la columna organization_id como espejo; su validez queda
--    garantizada por la FK compuesta (no es una fuente de verdad separada).
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_organization_id_fkey;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_projects_fair_org') THEN
        ALTER TABLE projects
            ADD CONSTRAINT fk_projects_fair_org
            FOREIGN KEY (fair_id, organization_id) REFERENCES fairs(id, organization_id)
            ON DELETE RESTRICT
            ON UPDATE RESTRICT;
    END IF;
END $$;

-- 4. Backfill seguro: projects.fair_id -> NOT NULL SOLO si no hay huérfanos.
--    Nunca se crea una feria ficticia; se notifica cuántos proyectos quedan
--    pendientes de asignar a una feria real.
DO $$
DECLARE orphan_count BIGINT;
BEGIN
    SELECT COUNT(*) INTO orphan_count FROM projects WHERE fair_id IS NULL;

    IF orphan_count = 0 THEN
        ALTER TABLE projects ALTER COLUMN fair_id SET NOT NULL;
        RAISE NOTICE 'projects.fair_id activado como NOT NULL (sin proyectos huérfanos).';
    ELSE
        RAISE NOTICE 'La columna projects.fair_id permanece nullable: % proyecto(s) existente(s) aún sin feria real asignada. Asignar una feria (API) para completar la migración.', orphan_count;
    END IF;
END $$;

COMMIT;