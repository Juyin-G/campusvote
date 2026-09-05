-- elections/010_candidacy_advisor.sql
-- Docente asesor del proyecto (candidacies.advisor_id). Clave para detectar
-- conflictos de interés: un jurado no puede evaluar un proyecto que asesora.

BEGIN;

ALTER TABLE candidacies ADD COLUMN IF NOT EXISTS advisor_id UUID;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_candidacies_advisor') THEN
        ALTER TABLE candidacies
            ADD CONSTRAINT fk_candidacies_advisor
            FOREIGN KEY (advisor_id) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_candidacies_advisor_id ON candidacies (advisor_id);

COMMIT;