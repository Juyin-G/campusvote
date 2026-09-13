-- projects/003_projects_category_stand.sql
-- Vincula PROJECT con su CATEGORÍA y STAND de feria.
--
-- Estrategia (no destructiva, espejo de la FK compuesta de fairness):
--   1. Se añaden projects.category_id y projects.stand_id (ambos NULL).
--   2. "1 stand = 1 proyecto": UNIQUE (projects.stand_id); NULLs múltiples
--      permitidos hasta que el proyecto ocupe una cabina.
--   3. FK simples category/stand -> fair_categories/fair_stands (RESTRICT).
--   4. FK COMPUESTAS (category_id, fair_id) y (stand_id, fair_id):
--      la categoría y el stand SIEMPRE pertenecen a la MISMA feria que el
--      proyecto (la feria sigue siendo la fuente de verdad de la organización).
--
-- Requiere fairs/007_fair_categories.sql y fairs/008_fair_stands.sql aplicados.

BEGIN;

ALTER TABLE projects ADD COLUMN IF NOT EXISTS category_id UUID;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS stand_id UUID;

CREATE INDEX IF NOT EXISTS idx_projects_category
    ON projects (category_id);
CREATE INDEX IF NOT EXISTS idx_projects_stand
    ON projects (stand_id);

-- 1 stand = 1 proyecto.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_projects_stand') THEN
        ALTER TABLE projects ADD CONSTRAINT uq_projects_stand UNIQUE (stand_id);
    END IF;
END $$;

-- FK simples (existencia y RESTRICT).
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_projects_category') THEN
        ALTER TABLE projects
            ADD CONSTRAINT fk_projects_category
            FOREIGN KEY (category_id) REFERENCES fair_categories(id)
            ON DELETE RESTRICT;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_projects_stand') THEN
        ALTER TABLE projects
            ADD CONSTRAINT fk_projects_stand
            FOREIGN KEY (stand_id) REFERENCES fair_stands(id)
            ON DELETE RESTRICT;
    END IF;
END $$;

-- FK compuestas de integridad (category/stand de la MISMA feria).
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_projects_category_fair') THEN
        ALTER TABLE projects
            ADD CONSTRAINT fk_projects_category_fair
            FOREIGN KEY (category_id, fair_id) REFERENCES fair_categories(id, fair_id)
            ON DELETE RESTRICT
            ON UPDATE RESTRICT;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_projects_stand_fair') THEN
        ALTER TABLE projects
            ADD CONSTRAINT fk_projects_stand_fair
            FOREIGN KEY (stand_id, fair_id) REFERENCES fair_stands(id, fair_id)
            ON DELETE RESTRICT
            ON UPDATE RESTRICT;
    END IF;
END $$;

COMMIT;