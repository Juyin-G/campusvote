-- // 008_candidate_lists_fair_profile.sql
-- Perfil descriptivo de proyectos para ferias/concursos (processType FAIR/AWARD):
-- añade descripción, imagen, categoría y etiquetas a candidate_lists.
-- Idempotente para bases existentes (004 cubre instalaciones nuevas).

BEGIN;

ALTER TABLE candidate_lists ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE candidate_lists ADD COLUMN IF NOT EXISTS image_url VARCHAR(1000);
ALTER TABLE candidate_lists ADD COLUMN IF NOT EXISTS category VARCHAR(80);
ALTER TABLE candidate_lists ADD COLUMN IF NOT EXISTS tags JSONB NOT NULL DEFAULT '[]'::jsonb;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_candidate_lists_description_not_empty') THEN
        ALTER TABLE candidate_lists
            ADD CONSTRAINT chk_candidate_lists_description_not_empty
            CHECK (description IS NULL OR length(trim(description)) > 0);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_candidate_lists_image_url_not_empty') THEN
        ALTER TABLE candidate_lists
            ADD CONSTRAINT chk_candidate_lists_image_url_not_empty
            CHECK (image_url IS NULL OR length(trim(image_url)) > 0);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_candidate_lists_category_not_empty') THEN
        ALTER TABLE candidate_lists
            ADD CONSTRAINT chk_candidate_lists_category_not_empty
            CHECK (category IS NULL OR length(trim(category)) > 0);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_candidate_lists_category ON candidate_lists (category);

COMMIT;