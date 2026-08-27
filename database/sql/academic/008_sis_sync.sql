-- 008_sis_sync.sql (Versión Final Completa)

BEGIN;

CREATE OR REPLACE FUNCTION sync_sis_voters(
    p_operator_user_id UUID,
    p_period_id UUID,
    p_students JSONB
)
RETURNS TABLE (processed INT, updated INT, protected INT, unmatched INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_operator_role VARCHAR(20);
    v_period_active BOOLEAN;
    v_total_input   INT := 0;
    v_processed     INT := 0;
    v_updated       INT := 0;
    v_protected     INT := 0;
    v_unmatched     INT := 0;
BEGIN
    -- 1. VALIDACIÓN DE AUTORIZACIÓN (Rol ADMIN requerido)
    SELECT role::VARCHAR INTO v_operator_role
    FROM public.users
    WHERE id = p_operator_user_id AND status = 'ACTIVE';

    IF v_operator_role IS NULL OR v_operator_role != 'ADMIN' THEN
        RAISE EXCEPTION 'Acceso denegado: Solo administradores pueden ejecutar la sincronización SIS.';
    END IF;

    -- 2. VALIDACIÓN DE PERÍODO ACADÉMICO ACTIVO
    SELECT is_active INTO v_period_active
    FROM public.academic_periods
    WHERE id = p_period_id;

    IF v_period_active IS NOT TRUE THEN
        RAISE EXCEPTION 'Operación cancelada: El período académico especificado no existe o está inactivo.';
    END IF;

    -- 3. RETORNO TEMPRANO SI EL PAYLOAD VIENE VACÍO
    IF p_students IS NULL OR jsonb_array_length(p_students) = 0 THEN
        RETURN QUERY SELECT 0, 0, 0, 0;
        RETURN;
    END IF;

    v_total_input := jsonb_array_length(p_students);

    -- 4. EJECUCIÓN LÓGICA CON CTEs
    WITH input_data AS (
        -- Deduplicación determinista de entrada
        SELECT DISTINCT ON (trim(s->>'institutional_id'))
            trim(s->>'institutional_id') AS institutional_id,
            (s->>'program_id')::UUID AS program_id,
            (s->>'cycle')::INT AS cycle
        FROM jsonb_array_elements(p_students) AS s
        WHERE (s->>'institutional_id') IS NOT NULL 
          AND length(trim(s->>'institutional_id')) > 0
        ORDER BY trim(s->>'institutional_id')
    ),
    matched_users AS (
        SELECT
            u.id AS user_id,
            d.program_id,
            d.cycle
        FROM input_data d
        JOIN public.users u ON u.institutional_id = d.institutional_id
        WHERE u.status = 'ACTIVE' 
          AND u.role = 'STUDENT'
    ),
    updated_users AS (
        -- Actualización del ciclo actual en perfil de usuario
        UPDATE public.users u
        SET current_cycle = m.cycle,
            updated_at = CURRENT_TIMESTAMP
        FROM matched_users m
        WHERE u.id = m.user_id
        RETURNING u.id
    ),
    upserted_voters AS (
        -- Inserción / Actualización en padrón electoral
        INSERT INTO public.voter_registries (
            user_id, program_id, period_id, semester, is_eligible, eligibility_reason
        )
        SELECT
            m.user_id,
            m.program_id,
            p_period_id,
            m.cycle,
            TRUE,
            'ENROLLED_SIS'
        FROM matched_users m
        ON CONFLICT (user_id, period_id)
        DO UPDATE SET
            program_id = EXCLUDED.program_id,
            semester = EXCLUDED.semester,
            updated_at = CURRENT_TIMESTAMP
        -- Protege inhabilitaciones manuales o decisiones de reclamo
        WHERE voter_registries.eligibility_reason = 'ENROLLED_SIS'
           OR voter_registries.eligibility_reason IS NULL
        RETURNING (xmax = 0) AS is_insert
    ),
    stats AS (
        SELECT
            (SELECT COUNT(*)::INT FROM matched_users) AS total_matched,
            (SELECT COUNT(*)::INT FROM upserted_voters) AS total_processed,
            (SELECT COUNT(*)::INT FROM upserted_voters WHERE NOT is_insert) AS total_updated,
            (SELECT COUNT(*)::INT FROM updated_users) AS dummy_sync_users
    )
    SELECT
        total_processed,
        total_updated,
        (total_matched - total_processed) AS protected_count,
        (v_total_input - total_matched) AS unmatched_count
    INTO v_processed, v_updated, v_protected, v_unmatched
    FROM stats;

    RETURN QUERY SELECT v_processed, v_updated, v_protected, v_unmatched;
END;
$$;

-- GOBERNANZA DE PERMISOS
REVOKE ALL ON FUNCTION sync_sis_voters(UUID, UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sync_sis_voters(UUID, UUID, JSONB) TO app_user;

COMMIT;