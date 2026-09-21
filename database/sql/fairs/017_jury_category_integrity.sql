-- fairs/017_jury_category_integrity.sql
-- Trigger de integridad para fair_jury_category_assignments:
--   * La categoría debe pertenecer a la MISMA feria que la asignación del jurado.
--   * El usuario debe tener rol global JURY y estar ACTIVE.
--   * El usuario debe pertenecer a la MISMA organización que la feria.
--
-- Defensa en profundidad: el service ya valida estas reglas; este trigger
-- es el candado final de la BD.

BEGIN;

CREATE OR REPLACE FUNCTION enforce_jury_category_assignment_rules()
RETURNS TRIGGER AS $$
DECLARE
    v_jury_fair_id   UUID;
    v_jury_user_id   UUID;
    v_category_fair  UUID;
    v_user_role      users.role%TYPE;
    v_user_status    users.status%TYPE;
    v_user_org       UUID;
    v_fair_org       UUID;
BEGIN
    -- Obtener la asignación jurado→feria.
    SELECT fair_id, user_id
        INTO v_jury_fair_id, v_jury_user_id
        FROM fair_jury_assignments
        WHERE id = NEW.jury_assignment_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'La asignación de jurado no existe';
    END IF;

    -- Obtener la categoría y su feria.
    SELECT fair_id
        INTO v_category_fair
        FROM fair_categories
        WHERE id = NEW.category_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'La categoría no existe';
    END IF;

    -- La categoría debe pertenecer a la misma feria que la asignación del jurado.
    IF v_jury_fair_id IS DISTINCT FROM v_category_fair THEN
        RAISE EXCEPTION 'La categoría no pertenece a la misma feria que la asignación del jurado';
    END IF;

    -- Verificar que el usuario tiene rol JURY y está activo.
    SELECT role, status, organization_id
        INTO v_user_role, v_user_status, v_user_org
        FROM users WHERE id = v_jury_user_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'El usuario no existe';
    END IF;

    IF v_user_role <> 'JURY' THEN
        RAISE EXCEPTION 'Solo los usuarios con rol global JURY pueden ser asignados a categorías';
    END IF;
    IF v_user_status <> 'ACTIVE' THEN
        RAISE EXCEPTION 'El jurado no está activo';
    END IF;

    -- Verificar pertenencia a la misma organización.
    SELECT organization_id INTO v_fair_org FROM fairs WHERE id = v_jury_fair_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'La feria no existe';
    END IF;

    IF v_user_org IS DISTINCT FROM v_fair_org THEN
        RAISE EXCEPTION 'El jurado no pertenece a la misma organización que la feria';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_jury_category_assignment_rules ON fair_jury_category_assignments;
CREATE TRIGGER trg_jury_category_assignment_rules
BEFORE INSERT OR UPDATE ON fair_jury_category_assignments
FOR EACH ROW EXECUTE FUNCTION enforce_jury_category_assignment_rules();

COMMIT;
