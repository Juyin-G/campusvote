-- fairs/010_jury_assignment_integrity.sql
-- Refuerzo de INTEGRIDAD a nivel de BD para fair_jury_assignments:
--   * el usuario debe tener rol global JURY,
--   * el usuario debe estar ACTIVE,
--   * el usuario debe pertenecer a la MISMA organización que la feria
--     (la invariante de aislamiento se exige SIEMPRE, incluso si el actor
--     que asigna es SUPERADMIN).
--
-- El mismo conjunto de reglas se valida en juryAssignment.service.js; este
-- trigger es la defensa en profundidad (candado final de la BD).

BEGIN;

CREATE OR REPLACE FUNCTION enforce_fair_jury_assignment_rules()
RETURNS TRIGGER AS $$
DECLARE
    v_user_role    users.role%TYPE;
    v_user_status  users.status%TYPE;
    v_user_org     UUID;
    v_fair_org     UUID;
BEGIN
    SELECT role, status, organization_id
        INTO v_user_role, v_user_status, v_user_org
        FROM users WHERE id = NEW.user_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'El usuario no existe';
    END IF;

    IF v_user_role <> 'JURY' THEN
        RAISE EXCEPTION 'Solo los usuarios con rol global JURY pueden ser asignados como jurados';
    END IF;
    IF v_user_status <> 'ACTIVE' THEN
        RAISE EXCEPTION 'El jurado no está activo';
    END IF;

    SELECT organization_id INTO v_fair_org FROM fairs WHERE id = NEW.fair_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'La feria no existe';
    END IF;

    IF v_user_org IS DISTINCT FROM v_fair_org THEN
        RAISE EXCEPTION 'El jurado no pertenece a la misma organización que la feria';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_fair_jury_assignment_rules ON fair_jury_assignments;
CREATE TRIGGER trg_fair_jury_assignment_rules
BEFORE INSERT OR UPDATE ON fair_jury_assignments
FOR EACH ROW EXECUTE FUNCTION enforce_fair_jury_assignment_rules();

COMMIT;