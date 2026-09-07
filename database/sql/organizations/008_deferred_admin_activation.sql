-- 008_deferred_admin_activation.sql
-- Approval sends an invitation; organization and ADMIN are created on activation.

BEGIN;

ALTER TABLE organization_requests
    ADD COLUMN IF NOT EXISTS activation_token_hash VARCHAR(255),
    ADD COLUMN IF NOT EXISTS activation_expires_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS activation_used BOOLEAN NOT NULL DEFAULT FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS uq_org_requests_activation_token_hash
    ON organization_requests (activation_token_hash)
    WHERE activation_token_hash IS NOT NULL;

CREATE OR REPLACE FUNCTION approve_request_for_admin_activation(
    p_request_id UUID,
    p_reviewer_user_id UUID
)
RETURNS TABLE(out_request_id UUID, out_raw_token TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_request RECORD;
    v_raw_token TEXT;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM users
        WHERE id = p_reviewer_user_id
          AND status = 'ACTIVE'
          AND is_staff = TRUE
    ) THEN
        RAISE EXCEPTION 'El revisor no está activo o no posee permisos.';
    END IF;

    SELECT * INTO v_request
    FROM organization_requests
    WHERE id = p_request_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Solicitud no encontrada.';
    END IF;

    IF v_request.status <> 'PENDING' THEN
        RAISE EXCEPTION 'La solicitud ya ha sido procesada.';
    END IF;

    v_raw_token := encode(gen_random_bytes(32), 'hex');

    UPDATE organization_requests
    SET status = 'APPROVED',
        reviewed_by = p_reviewer_user_id,
        reviewed_at = CURRENT_TIMESTAMP,
        activation_token_hash = encode(digest(v_raw_token, 'sha256'), 'hex'),
        activation_expires_at = CURRENT_TIMESTAMP + INTERVAL '24 hours',
        activation_used = FALSE
    WHERE id = p_request_id;

    out_request_id := p_request_id;
    out_raw_token := v_raw_token;
    RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION activate_organization_request(
    p_raw_token TEXT,
    p_password_hash TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_request RECORD;
    v_org_id UUID;
    v_user_id UUID;
    v_hash TEXT;
    v_localpart TEXT;
    v_username TEXT;
    v_institutional_id TEXT;
    v_code TEXT;
    v_slug TEXT;
    v_attempt INT := 0;
BEGIN
    IF p_raw_token IS NULL OR p_password_hash IS NULL
       OR length(trim(p_raw_token)) = 0 OR length(p_password_hash) = 0 THEN
        RETURN NULL;
    END IF;

    v_hash := encode(digest(p_raw_token, 'sha256'), 'hex');

    SELECT * INTO v_request
    FROM organization_requests
    WHERE activation_token_hash = v_hash
      AND activation_used = FALSE
      AND activation_expires_at > CURRENT_TIMESTAMP
      AND status = 'APPROVED'
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    FOR v_attempt IN 1..3 LOOP
        BEGIN
            v_slug := UPPER(SUBSTRING(regexp_replace(unaccent(v_request.institution_name), '[^a-zA-Z0-9]', '', 'g') FROM 1 FOR 10));
            IF length(v_slug) = 0 THEN v_slug := 'ORG'; END IF;
            v_code := v_slug || '_' || UPPER(SUBSTRING(gen_random_uuid()::text FROM 1 FOR 4));

            INSERT INTO organizations (name, code, org_type, country, onboarding_completed, member_limit)
            VALUES (v_request.institution_name, v_code, v_request.institution_type,
                    v_request.country, FALSE, v_request.estimated_members)
            RETURNING id INTO v_org_id;
            EXIT;
        EXCEPTION WHEN unique_violation THEN
            IF v_attempt = 3 THEN RAISE; END IF;
        END;
    END LOOP;

    v_localpart := lower(regexp_replace(split_part(v_request.contact_email, '@', 1), '[^a-z0-9._-]', '', 'g'));
    IF length(v_localpart) = 0 THEN v_localpart := 'admin'; END IF;
    v_username := v_localpart;
    v_attempt := 0;
    WHILE EXISTS (SELECT 1 FROM users WHERE username = v_username) LOOP
        v_attempt := v_attempt + 1;
        v_username := v_localpart || '_' || substr(md5(random()::text), 1, 4);
        IF v_attempt > 50 THEN
            RAISE EXCEPTION 'No fue posible generar un username único.';
        END IF;
    END LOOP;

    v_attempt := 0;
    LOOP
        v_institutional_id := substr(v_localpart || '-ADMIN-' || upper(substr(md5(random()::text), 1, 8)), 1, 30);
        EXIT WHEN NOT EXISTS (SELECT 1 FROM users WHERE institutional_id = v_institutional_id);
        v_attempt := v_attempt + 1;
        IF v_attempt > 50 THEN RAISE EXCEPTION 'No fue posible generar un identificador único.'; END IF;
    END LOOP;

    INSERT INTO users (
        email, username, password, auth_provider, role, status, organization_id,
        is_verified, must_change_password, must_setup_2fa, institutional_id,
        first_name, last_name
    ) VALUES (
        v_request.contact_email, v_username, p_password_hash, 'LOCAL'::auth_provider_type,
        'ADMIN'::user_role, 'PENDING_ACTIVATION'::user_status, v_org_id,
        TRUE, FALSE, TRUE, v_institutional_id, 'Administrador', ''
    )
    RETURNING id INTO v_user_id;

    UPDATE organization_requests
    SET activation_used = TRUE
    WHERE id = v_request.id;

    RETURN v_user_id;
END;
$$;

REVOKE ALL ON FUNCTION approve_request_for_admin_activation(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION approve_request_for_admin_activation(UUID, UUID) TO app_user;
REVOKE ALL ON FUNCTION activate_organization_request(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION activate_organization_request(TEXT, TEXT) TO app_user;

COMMIT;
