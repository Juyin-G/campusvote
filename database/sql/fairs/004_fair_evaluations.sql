-- fairs/004_fair_evaluations.sql
-- Evaluaciones de proyectos (fair_evaluations + fair_evaluation_details).
-- Dominio exclusivo de FERIAS. Integridad reforzada en PostgreSQL:
--
--   * UNIQUE (fair_id, project_id, jury_user_id): el mismo jurado NO puntúa
--     dos veces el mismo proyecto en la misma feria.
--   * FK compuesta (fair_id, project_id) -> projects(fair_id, id): el proyecto
--     pertenece a la MISMA feria que la evaluación.
--   * FK compuesta (fair_id, jury_user_id) -> fair_jury_assignments(fair_id,
--     user_id): el jurado está formalmente asignado a esa feria.
--   * FK compuesta (fair_id, rubric_id)     -> fair_rubrics(fair_id, id):
--     la rúbrica de la evaluación es la de la feria.
--   * FK compuesta (evaluation_id, rubric_id) -> fair_evaluations(id, rubric_id):
--     el detalle usa la rúbrica de su evaluación (criterios coherentes).
--   * FK compuesta (criterion_id, rubric_id) -> rubric_criteria(id, rubric_id):
--     cada criterio del detalle pertenece a esa rúbrica.
--   * Trigger: score dentro de [min_score, max_score] del criterio.
--   * Trigger: solo INSERT/UPDATE en fair.status = OPEN y project.status =
--     APPROVED (equivalente a enforce_election_immutability del dominio electoral).

BEGIN;

-- UNIQUE auxiliar para la FK compuesta proyecto↔feria.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_projects_id_fair') THEN
        ALTER TABLE projects ADD CONSTRAINT uq_projects_id_fair UNIQUE (id, fair_id);
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS fair_evaluations (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fair_id      UUID NOT NULL,
    project_id   UUID NOT NULL,
    jury_user_id UUID NOT NULL,
    rubric_id    UUID NOT NULL,
    total_score  NUMERIC(10,2) NOT NULL DEFAULT 0,
    comment      TEXT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_fair_evaluations_fair_project_jury UNIQUE (fair_id, project_id, jury_user_id),
    CONSTRAINT fk_fair_evaluations_fair    FOREIGN KEY (fair_id)      REFERENCES fairs(id)                ON DELETE RESTRICT,
    CONSTRAINT fk_fair_evaluations_project FOREIGN KEY (project_id)   REFERENCES projects(id)             ON DELETE RESTRICT,
    CONSTRAINT fk_fair_evaluations_jury    FOREIGN KEY (jury_user_id) REFERENCES users(id)                ON DELETE RESTRICT,
    CONSTRAINT fk_fair_evaluations_rubric  FOREIGN KEY (rubric_id)    REFERENCES fair_rubrics(id)         ON DELETE RESTRICT,
    -- Integridad: proyecto y evaluación en la MISMA feria.
    -- IMPORTANTE: el orden de columnas debe emparejar posición a posición con
    -- uq_projects_id_fair (id, fair_id): project_id -> projects.id y
    -- fair_id -> projects.fair_id. (Antes estaba invertido y hacía imposible
    -- insertar evaluaciones/votos.)
    CONSTRAINT fk_fair_evaluations_fair_project FOREIGN KEY (project_id, fair_id)
        REFERENCES projects(id, fair_id) ON DELETE RESTRICT,
    -- Integridad: jurado formalmente asignado a la feria (impide evaluar sin asignación).
    CONSTRAINT fk_fair_evaluations_fair_jury FOREIGN KEY (fair_id, jury_user_id)
        REFERENCES fair_jury_assignments(fair_id, user_id) ON DELETE RESTRICT,
    -- Integridad: la rúbrica es la de la feria.
    CONSTRAINT fk_fair_evaluations_fair_rubric FOREIGN KEY (fair_id, rubric_id)
        REFERENCES fair_rubrics(fair_id, id) ON DELETE RESTRICT
);

-- UNIQUE auxiliar (id, rubric_id) para la FK compuesta del detalle.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_fair_evaluations_id_rubric') THEN
        ALTER TABLE fair_evaluations ADD CONSTRAINT uq_fair_evaluations_id_rubric UNIQUE (id, rubric_id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_fair_evaluations_jury   ON fair_evaluations (jury_user_id);
CREATE INDEX IF NOT EXISTS idx_fair_evaluations_project ON fair_evaluations (project_id);

CREATE TABLE IF NOT EXISTS fair_evaluation_details (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evaluation_id UUID NOT NULL,
    criterion_id UUID NOT NULL,
    rubric_id    UUID NOT NULL,
    score        NUMERIC(5,2) NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_fair_evaluation_details_eval_criterion UNIQUE (evaluation_id, criterion_id),
    CONSTRAINT fk_fair_evaluation_details_evaluation FOREIGN KEY (evaluation_id) REFERENCES fair_evaluations(id) ON DELETE CASCADE,
    -- El criterio del detalle pertenece a la rúbrica indicada.
    CONSTRAINT fk_fair_evaluation_details_criterion_rubric FOREIGN KEY (criterion_id, rubric_id)
        REFERENCES rubric_criteria(id, rubric_id) ON DELETE RESTRICT,
    -- La rúbrica del detalle es la de su evaluación.
    CONSTRAINT fk_fair_evaluation_details_eval_rubric FOREIGN KEY (evaluation_id, rubric_id)
        REFERENCES fair_evaluations(id, rubric_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_fair_evaluation_details_criterion
    ON fair_evaluation_details (criterion_id);

-- TRIGGER: score dentro del rango [min_score, max_score] del criterio.
CREATE OR REPLACE FUNCTION validate_fair_evaluation_detail()
RETURNS TRIGGER AS $$
DECLARE
    v_min NUMERIC(5,2);
    v_max NUMERIC(5,2);
BEGIN
    SELECT min_score, max_score INTO v_min, v_max
    FROM rubric_criteria
    WHERE id = NEW.criterion_id AND rubric_id = NEW.rubric_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'El criterio no pertenece a la rúbrica de la evaluación';
    END IF;

    IF NEW.score < v_min OR NEW.score > v_max THEN
        RAISE EXCEPTION 'La puntuación % está fuera del rango [%, %] del criterio', NEW.score, v_min, v_max;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_fair_evaluation_details_score ON fair_evaluation_details;
CREATE TRIGGER trg_fair_evaluation_details_score
BEFORE INSERT OR UPDATE ON fair_evaluation_details
FOR EACH ROW EXECUTE FUNCTION validate_fair_evaluation_detail();

-- TRIGGER: solo evalúan proyectos APPROVED en ferias OPEN.
CREATE OR REPLACE FUNCTION enforce_fair_evaluation_rules()
RETURNS TRIGGER AS $$
DECLARE
    v_fair_status fairs.status%TYPE;
    v_project_status projects.status%TYPE;
    v_project_fair projects.fair_id%TYPE;
BEGIN
    SELECT status INTO v_fair_status FROM fairs WHERE id = NEW.fair_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'La feria no existe';
    END IF;
    IF v_fair_status <> 'OPEN' THEN
        RAISE EXCEPTION 'Solo se pueden crear o modificar evaluaciones mientras la feria está abierta (OPEN)';
    END IF;

    SELECT status, fair_id INTO v_project_status, v_project_fair
    FROM projects WHERE id = NEW.project_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'El proyecto no existe';
    END IF;
    IF v_project_status <> 'APPROVED' THEN
        RAISE EXCEPTION 'Solo se pueden evaluar proyectos aprobados (APPROVED)';
    END IF;
    IF v_project_fair <> NEW.fair_id THEN
        RAISE EXCEPTION 'El proyecto no pertenece a la feria de la evaluación';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_fair_evaluations_rules ON fair_evaluations;
CREATE TRIGGER trg_fair_evaluations_rules
BEFORE INSERT OR UPDATE ON fair_evaluations
FOR EACH ROW EXECUTE FUNCTION enforce_fair_evaluation_rules();

-- TRIGGERS: updated_at
DROP TRIGGER IF EXISTS trg_fair_evaluations_updated_at ON fair_evaluations;
CREATE TRIGGER trg_fair_evaluations_updated_at
BEFORE UPDATE ON fair_evaluations
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_fair_evaluation_details_updated_at ON fair_evaluation_details;
CREATE TRIGGER trg_fair_evaluation_details_updated_at
BEFORE UPDATE ON fair_evaluation_details
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;