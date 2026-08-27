--src/database/sql/organizations/004_approval_functions.sql

BEGIN;

-- FUNCIÓN: PROCESAR SOLICITUD Y CREAR ORGANIZACIÓN

CREATE OR REPLACE FUNCTION approve_organization_request(
    p_request_id UUID,
    p_reviewer_user_id UUID,
    p_rejection_reason TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_request RECORD;
    v_new_org_id UUID;
    v_new_status organization_request_status;
    v_clean_slug TEXT;
    v_generated_code TEXT;
    v_reviewer_is_staff BOOLEAN;
BEGIN
    -- 1. Defensa en profundidad: Verificar que el revisor esté activo y sea staff
    SELECT is_staff INTO v_reviewer_is_staff
    FROM public.users
    WHERE id = p_reviewer_user_id AND status = 'ACTIVE';

    IF NOT FOUND OR v_reviewer_is_staff IS NOT TRUE THEN
        RAISE EXCEPTION 'El usuario % no está activo o no posee permisos para revisar solicitudes.', p_reviewer_user_id;
    END IF;

    -- 2. Bloqueo pesimista para evitar carreras de aprobación
    SELECT * INTO v_request
    FROM public.organization_requests
    WHERE id = p_request_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Solicitud no encontrada.';
    END IF;

    IF v_request.status != 'PENDING' THEN
        RAISE EXCEPTION 'La solicitud ya ha sido procesada. Estado actual: %', v_request.status;
    END IF;

    -- 3. Determinar estado
    IF p_rejection_reason IS NOT NULL AND length(trim(p_rejection_reason)) > 0 THEN
        v_new_status := 'REJECTED';
    ELSE
        v_new_status := 'APPROVED';
    END IF;

    -- 4. Actualizar la solicitud
    UPDATE public.organization_requests
    SET
        status = v_new_status,
        reviewed_by = p_reviewer_user_id,
        reviewed_at = CURRENT_TIMESTAMP,
        rejection_reason = CASE WHEN v_new_status = 'REJECTED' THEN p_rejection_reason ELSE NULL END
    WHERE id = p_request_id;

    -- 5. Si fue aprobada, crear la Organización con código sanitizado y reintento anticolisión
    IF v_new_status = 'APPROVED' THEN
        -- Transliterar tildes/caracteres especiales (ej. "Señor" -> "SENOR") y eliminar caracteres no alfanuméricos
        v_clean_slug := UPPER(regexp_replace(unaccent(v_request.institution_name), '[^a-zA-Z0-9]', '', 'g'));
        v_clean_slug := SUBSTRING(v_clean_slug FROM 1 FOR 10);

        IF length(v_clean_slug) = 0 THEN
            v_clean_slug := 'ORG';
        END IF;

        -- Bucle con tolerancia a fallos por colisión de clave única en 'code'
        FOR i IN 1..3 LOOP
            BEGIN
                v_generated_code := v_clean_slug || '_' || UPPER(SUBSTRING(gen_random_uuid()::text FROM 1 FOR 4));

                INSERT INTO public.organizations (
                    name,
                    code,
                    org_type,
                    country,
                    onboarding_completed
                )
                VALUES (
                    v_request.institution_name,
                    v_generated_code,
                    v_request.institution_type,
                    v_request.country,
                    FALSE
                )
                RETURNING id INTO v_new_org_id;

                EXIT; -- Inserción exitosa, salir del bucle
            EXCEPTION
                WHEN unique_violation THEN
                    IF i = 3 THEN
                        RAISE EXCEPTION 'No se pudo generar un código único para la organización tras 3 intentos.';
                    END IF;
            END;
        END LOOP;

        RETURN v_new_org_id;
    END IF;

    RETURN NULL;
END;
$$;

-- Permisos para la aplicación
REVOKE ALL ON FUNCTION approve_organization_request(UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION approve_organization_request(UUID, UUID, TEXT) TO app_user;

COMMIT;