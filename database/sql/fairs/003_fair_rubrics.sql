-- fairs/003_fair_rubrics.sql
-- Rúbrica de evaluación de UNA feria (dominio exclusivo de FERIAS).
-- No mezclar con feria_criteria (dominio electoral: election_id, peso ponderado
-- vigesimal). Estructura:
--   Fair ── FairRubric ── RubricCriterion
--
-- Decisiones:
--   * UNA rúbrica activa por feria (UNIQUE fair_id): sin versionado. No existe
--     necesidad real de múltiples rúbricas simultáneas ni historial.
--   * La rúbrica SOLO se configura en DRAFT (service) y se congela al abrir la
--     feria (OPEN): todos los jurados evalúan con las mismas reglas.
--   * Criterio: nombre, descripción opcional, puntuación mín/máx y position
--     (orden explícito). CHECK min <= max.

BEGIN;

CREATE TABLE IF NOT EXISTS fair_rubrics (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fair_id     UUID NOT NULL REFERENCES fairs(id) ON DELETE RESTRICT,
    name        VARCHAR(200) NOT NULL,
    description TEXT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Una sola rúbrica activa por feria.
    CONSTRAINT uq_fair_rubrics_fair UNIQUE (fair_id)
);

-- Par clave (fair_id, id) para la FK compuesta desde fair_evaluations.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_fair_rubrics_fair_id') THEN
        ALTER TABLE fair_rubrics ADD CONSTRAINT uq_fair_rubrics_fair_id UNIQUE (fair_id, id);
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS rubric_criteria (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rubric_id   UUID NOT NULL REFERENCES fair_rubrics(id) ON DELETE CASCADE,
    name        VARCHAR(200) NOT NULL,
    description TEXT NULL,
    min_score   NUMERIC(5,2) NOT NULL DEFAULT 1,
    max_score   NUMERIC(5,2) NOT NULL DEFAULT 5,
    position    SMALLINT NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Orden único por rúbrica.
    CONSTRAINT uq_rubric_criteria_rubric_position UNIQUE (rubric_id, position),
    -- Rango de puntuación coherente.
    CONSTRAINT chk_rubric_criteria_score_range CHECK (min_score >= 0 AND max_score > 0 AND min_score <= max_score)
);

-- Par clave (id, rubric_id) para la FK compuesta desde fair_evaluation_details.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_rubric_criteria_id_rubric') THEN
        ALTER TABLE rubric_criteria ADD CONSTRAINT uq_rubric_criteria_id_rubric UNIQUE (id, rubric_id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_rubric_criteria_rubric
    ON rubric_criteria (rubric_id);

-- TRIGGERS: updated_at
DROP TRIGGER IF EXISTS trg_fair_rubrics_updated_at ON fair_rubrics;
CREATE TRIGGER trg_fair_rubrics_updated_at
BEFORE UPDATE ON fair_rubrics
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_rubric_criteria_updated_at ON rubric_criteria;
CREATE TRIGGER trg_rubric_criteria_updated_at
BEFORE UPDATE ON rubric_criteria
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;