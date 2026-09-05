-- ratings/002_feria_rubrics.sql
-- Rúbricas multicriterio (CONCYTEC/OCDE) para ferias peruanas.
-- Nuevas tablas feria_criteria y rating_details; ratings.score pasa de
-- SMALLINT (1-5 estrellas) a NUMERIC(5,2) (puntaje ponderado vigesimal 0-20).

BEGIN;

-- 1. CRITERIOS DE EVALUACIÓN CONFIGURADOS POR FERIA (vía ADMIN)
CREATE TABLE IF NOT EXISTS feria_criteria (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    election_id UUID NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    weight NUMERIC(5,2) NOT NULL,
    max_score SMALLINT NOT NULL DEFAULT 20,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_feria_criteria_election_name UNIQUE (election_id, name),
    CONSTRAINT chk_feria_criteria_weight CHECK (weight > 0 AND weight <= 1),
    CONSTRAINT chk_feria_criteria_max_score CHECK (max_score BETWEEN 1 AND 20)
);

CREATE INDEX IF NOT EXISTS idx_feria_criteria_election ON feria_criteria (election_id);

DROP TRIGGER IF EXISTS trg_feria_criteria_updated_at ON feria_criteria;
CREATE TRIGGER trg_feria_criteria_updated_at
BEFORE UPDATE ON feria_criteria
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Inmutabilidad: los criterios no se pueden crear/editar/borrar una vez que la
-- feria salió de DRAFT/SCHEDULED (mismo patrón que positions/ballots).
DROP TRIGGER IF EXISTS trg_feria_criteria_immutability ON feria_criteria;
CREATE TRIGGER trg_feria_criteria_immutability
BEFORE INSERT OR UPDATE OR DELETE ON feria_criteria
FOR EACH ROW EXECUTE FUNCTION enforce_election_immutability();

-- 2. DETALLE DE NOTA POR CRITERIO (matriz trazable por jurado)
CREATE TABLE IF NOT EXISTS rating_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rating_id UUID NOT NULL REFERENCES ratings(id) ON DELETE CASCADE,
    criterion_id UUID NOT NULL REFERENCES feria_criteria(id) ON DELETE RESTRICT,
    score NUMERIC(5,2) NOT NULL,

    CONSTRAINT uq_rating_details_rating_criterion UNIQUE (rating_id, criterion_id),
    CONSTRAINT chk_rating_details_score CHECK (score >= 0)
);

CREATE INDEX IF NOT EXISTS idx_rating_details_criterion ON rating_details (criterion_id);

-- 3. SCORE DE RATINGS: estrellas (1-5) -> puntaje ponderado vigesimal (0-20)
ALTER TABLE ratings DROP CONSTRAINT IF EXISTS ratings_score_check;
ALTER TABLE ratings ALTER COLUMN score TYPE NUMERIC(5,2) USING score::numeric;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_ratings_score_vigesimal') THEN
        ALTER TABLE ratings ADD CONSTRAINT chk_ratings_score_vigesimal
            CHECK (score BETWEEN 0 AND 20);
    END IF;
END $$;

-- 4. FK diferida: criterio de desempate en election_rules -> feria_criteria
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_election_rules_tie_breaker') THEN
        ALTER TABLE election_rules
            ADD CONSTRAINT fk_election_rules_tie_breaker
            FOREIGN KEY (tie_breaker_criterion_id) REFERENCES feria_criteria(id) ON DELETE SET NULL;
    END IF;
END $$;

COMMIT;