-- fairs/012a_fair_rubric_to_checklist.sql
-- Refactor de la rúbrica CHECKLIST (parte 1): columnas y triggers.
-- La parte 2 (012b) agrega las tablas de votación.

BEGIN;

-- =====================================================================
-- 1) fair_evaluations → HOJA de respuestas de la rúbrica (CHECKLIST)
-- =====================================================================
ALTER TABLE fair_evaluations
    DROP COLUMN IF EXISTS total_score;

ALTER TABLE fair_evaluations
    ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ NULL;

ALTER TABLE fair_evaluations
    DROP COLUMN IF EXISTS comment;

-- =====================================================================
-- 2) fair_evaluation_details → CHECKS booleanos
-- =====================================================================
ALTER TABLE fair_evaluation_details
    DROP COLUMN IF EXISTS score;

ALTER TABLE fair_evaluation_details
    ADD COLUMN IF NOT EXISTS checked BOOLEAN NOT NULL DEFAULT FALSE;

-- =====================================================================
-- 3) rubric_criteria → sin rangos numéricos, añadir is_active
-- =====================================================================
ALTER TABLE rubric_criteria
    DROP CONSTRAINT IF EXISTS chk_rubric_criteria_score_range;

ALTER TABLE rubric_criteria
    DROP COLUMN IF EXISTS min_score;

ALTER TABLE rubric_criteria
    DROP COLUMN IF EXISTS max_score;

ALTER TABLE rubric_criteria
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- =====================================================================
-- 4) Triggers: immutabilidad de submitted_at y reemplazo del state trigger
-- =====================================================================

DROP TRIGGER IF EXISTS trg_fair_evaluation_details_score
    ON fair_evaluation_details;
DROP FUNCTION IF EXISTS validate_fair_evaluation_detail();

CREATE OR REPLACE FUNCTION enforce_fair_evaluation_submitted_immutability()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.submitted_at IS NOT NULL
       AND NEW.submitted_at IS DISTINCT FROM OLD.submitted_at THEN
        RAISE EXCEPTION 'La rúbrica ya fue finalizada y no puede modificarse';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_fair_evaluations_submitted_immutability
    ON fair_evaluations;
CREATE TRIGGER trg_fair_evaluations_submitted_immutability
BEFORE UPDATE ON fair_evaluations
FOR EACH ROW EXECUTE FUNCTION enforce_fair_evaluation_submitted_immutability();

CREATE OR REPLACE FUNCTION enforce_fair_evaluation_state()
RETURNS TRIGGER AS $$
DECLARE
    v_fair_status     fairs.status%TYPE;
    v_project_status  projects.status%TYPE;
    v_project_fair    projects.fair_id%TYPE;
BEGIN
    SELECT status INTO v_fair_status FROM fairs WHERE id = NEW.fair_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'La feria no existe';
    END IF;
    IF v_fair_status = 'CLOSED' THEN
        RAISE EXCEPTION 'La feria está finalizada y no se pueden modificar rúbricas de exposición';
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
FOR EACH ROW EXECUTE FUNCTION enforce_fair_evaluation_state();

COMMIT;
