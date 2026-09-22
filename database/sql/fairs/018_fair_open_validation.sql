-- fairs/018_fair_open_validation.sql
-- Trigger que bloquea la transición DRAFT → OPEN si:
--   1. Existe una categoría con proyectos participantes y ningún jurado asignado.
--   2. Existe un proyecto participante (SUBMITTED/APPROVED) sin categoría.
--
-- Refuerzo en BD de las validaciones hechas en fair.service.js.

BEGIN;

CREATE OR REPLACE FUNCTION validate_fair_open_transition()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_categories_without_jurors   INTEGER;
    v_projects_without_category   INTEGER;
BEGIN
    -- Solo evaluamos cuando la feria pasa de DRAFT a OPEN.
    IF OLD.status IS DISTINCT FROM 'DRAFT' OR NEW.status IS DISTINCT FROM 'OPEN' THEN
        RETURN NEW;
    END IF;

    -- 1) Categorías con proyectos participantes y sin jurados.
    SELECT COUNT(*) INTO v_categories_without_jurors
    FROM fair_categories fc
    WHERE fc.fair_id = NEW.id
      AND EXISTS (
          SELECT 1 FROM projects p
          WHERE p.category_id = fc.id
            AND p.status IN ('SUBMITTED', 'APPROVED')
      )
      AND NOT EXISTS (
          SELECT 1 FROM fair_jury_category_assignments fjca
          JOIN fair_jury_assignments fja ON fja.id = fjca.jury_assignment_id
          WHERE fjca.category_id = fc.id
            AND fja.fair_id = NEW.id
      );

    IF v_categories_without_jurors > 0 THEN
        RAISE EXCEPTION 'No se puede abrir la feria: existen categorías con proyectos participantes sin jurados asignados';
    END IF;

    -- 2) Proyectos participantes sin categoría.
    SELECT COUNT(*) INTO v_projects_without_category
    FROM projects p
    WHERE p.fair_id = NEW.id
      AND p.status IN ('SUBMITTED', 'APPROVED')
      AND p.category_id IS NULL;

    IF v_projects_without_category > 0 THEN
        RAISE EXCEPTION 'No se puede abrir la feria: existen proyectos participantes sin categoría asignada';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fair_open_validation ON fairs;
CREATE TRIGGER trg_fair_open_validation
BEFORE UPDATE ON fairs
FOR EACH ROW EXECUTE FUNCTION validate_fair_open_transition();

COMMIT;
