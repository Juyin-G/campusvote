BEGIN;

-- FUNCIÓN: OBTENER VOTANTES ELEGIBLES POR PERIODO
CREATE OR REPLACE FUNCTION get_eligible_voters(
    p_period_id UUID
)
RETURNS TABLE (
    user_id UUID,
    email CITEXT,
    institutional_id CITEXT,
    full_name TEXT,
    program_name VARCHAR,
    semester SMALLINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT
        vr.user_id,
        u.email,
        u.institutional_id,
        CONCAT(u.first_name, ' ', u.last_name) AS full_name,
        p.name AS program_name,
        vr.semester
    FROM public.voter_registries vr
    JOIN public.users u ON vr.user_id = u.id
    JOIN public.programs p ON vr.program_id = p.id
    JOIN public.academic_periods ap ON vr.period_id = ap.id
    WHERE vr.period_id = p_period_id
      AND vr.is_eligible = TRUE
      AND u.status = 'ACTIVE'
      AND u.is_verified = TRUE
      AND ap.is_active = TRUE
    ORDER BY p.name, u.last_name, u.first_name;
$$;

-- FUNCIÓN: VERIFICAR SI UN USUARIO PUEDE VOTAR
CREATE OR REPLACE FUNCTION can_user_vote(
    p_user_id UUID,
    p_period_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.voter_registries vr
        JOIN public.users u ON vr.user_id = u.id
        JOIN public.academic_periods ap ON vr.period_id = ap.id
        WHERE vr.user_id = p_user_id
          AND vr.period_id = p_period_id
          AND vr.is_eligible = TRUE
          AND u.status = 'ACTIVE'
          AND u.is_verified = TRUE
          AND ap.is_active = TRUE
    );
$$;

-- RESTRICCIÓN DE PERMISOS (Gobernanza de Acceso a PII)
REVOKE ALL ON FUNCTION get_eligible_voters(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_eligible_voters(UUID) TO app_user;

REVOKE ALL ON FUNCTION can_user_vote(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION can_user_vote(UUID, UUID) TO app_user;

COMMIT;