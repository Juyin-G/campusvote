--- // 005_voter_validation.sql (Refactorizado)
BEGIN;

-- FUNCIÓN: VALIDAR PERIODO ACTIVO PARA VOTANTE
CREATE OR REPLACE FUNCTION check_period_active_for_voter()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_period_active BOOLEAN;
BEGIN
    SELECT is_active
    INTO v_period_active
    FROM public.academic_periods
    WHERE id = NEW.period_id;

    IF v_period_active IS NOT TRUE THEN
        RAISE EXCEPTION 'No se puede asociar votantes a un período académico inactivo o inexistente.';
    END IF;

    RETURN NEW;
END;
$$;

-- TRIGGER: VALIDAR PERIODO ACTIVO EN INSERT/UPDATE
DROP TRIGGER IF EXISTS trg_check_period_active ON voter_registries;

CREATE TRIGGER trg_check_period_active
BEFORE INSERT OR UPDATE ON voter_registries
FOR EACH ROW
EXECUTE FUNCTION check_period_active_for_voter();

COMMIT;