-- fairs/007_fair_categories.sql
-- Categorías estadísticas de UNA feria (dominio exclusivo de FERIAS).
-- Estructura:
--   Fair ── FairCategory (fair_id, name) ── Project (projects.category_id)
--
-- Decisiones:
--   * NO existe catálogo global: cada feria define sus categorías en DRAFT
--     (no se reutiliza el catálogo OCDE/CONCYTEC de candidate_lists, dominio
--     electoral: organizations.category_catalog es un JSONB ajeno a las ferias).
--   * UNIQUE (fair_id, name): delimitada por feria y sin duplicados.
--   * Par clave (id, fair_id): destino de la FK compuesta desde projects
--     (projects/003) que asegura "la categoría pertenece a la MISMA feria
--     que el proyecto".
--   * Los proyectos referencian categorías con ON DELETE RESTRICT: el backend
--     devuelve 409 (no el FK) cuando hay proyectos usando la categoría.

BEGIN;

CREATE TABLE IF NOT EXISTS fair_categories (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fair_id     UUID NOT NULL REFERENCES fairs(id) ON DELETE CASCADE,
    name        VARCHAR(200) NOT NULL,
    description TEXT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_fair_categories_fair_name UNIQUE (fair_id, name),
    CONSTRAINT chk_fair_categories_name_not_empty CHECK (length(trim(name)) > 0)
);

-- Par clave (id, fair_id) para la FK compuesta desde projects.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_fair_categories_id_fair') THEN
        ALTER TABLE fair_categories ADD CONSTRAINT uq_fair_categories_id_fair UNIQUE (id, fair_id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_fair_categories_fair
    ON fair_categories (fair_id);

-- TRIGGER: ACTUALIZAR updated_at
DROP TRIGGER IF EXISTS trg_fair_categories_updated_at ON fair_categories;
CREATE TRIGGER trg_fair_categories_updated_at
BEFORE UPDATE ON fair_categories
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;