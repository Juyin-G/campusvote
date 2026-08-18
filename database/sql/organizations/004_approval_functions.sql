BEGIN;

-- FUNCIÓN: PROCESAR SOLICITUD Y CREAR ORGANIZACIÓN

-- Bloqueo pesimista para evitar carreras de aprobación

CREATE OR REPLACE FUNCTION approve_organization_request(
    p_request_id UUID,
    p_reviewer_user_id UUID,
    p_rejection_reason TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
    v_request RECORD;
    v_new_org_id UUID;
    v_new_status organization_request_status;
    v_clean_slug TEXT;
BEGIN
    -- 1. Bloqueo pesimista para evitar carreras de aprobación
    SELECT * INTO v_request
    FROM organization_requests
    WHERE id = p_request_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Solicitud no encontrada.';
    END IF;

    IF v_request.status != 'PENDING' THEN
        RAISE EXCEPTION 'La solicitud ya ha sido procesada. Estado actual: %', v_request.status;
    END IF;

    -- 2. Determinar estado
    IF p_rejection_reason IS NOT NULL AND length(trim(p_rejection_reason)) > 0 THEN
        v_new_status := 'REJECTED';
    ELSE
        v_new_status := 'APPROVED';
    END IF;

    -- 3. Actualizar la solicitud
    UPDATE organization_requests
    SET
        status = v_new_status,
        reviewed_by = p_reviewer_user_id,
        reviewed_at = CURRENT_TIMESTAMP,
        rejection_reason = CASE WHEN v_new_status = 'REJECTED' THEN p_rejection_reason ELSE NULL END
    WHERE id = p_request_id;

    -- 4. Si fue aprobada, crear la Organización con código sanitizado
    IF v_new_status = 'APPROVED' THEN
        v_clean_slug := UPPER(regexp_replace(v_request.institution_name, '[^a-zA-Z0-9]', '', 'g'));
        v_clean_slug := SUBSTRING(v_clean_slug FROM 1 FOR 10);

        IF length(v_clean_slug) = 0 THEN
            v_clean_slug := 'ORG';
        END IF;

        INSERT INTO organizations (
            name,
            code,
            org_type,
            country,
            onboarding_completed
        )
        VALUES (
            v_request.institution_name,
            v_clean_slug || '_' || UPPER(SUBSTRING(gen_random_uuid()::text FROM 1 FOR 4)),
            v_request.institution_type,
            v_request.country,
            FALSE
        )
        RETURNING id INTO v_new_org_id;

        RETURN v_new_org_id;
    END IF;

    RETURN NULL;
END;
$$;

COMMIT;