-- 009_admin_scope_in_activation.sql
-- Redefine las funciones de creación de ADMIN (activate_organization_request y
-- admin_invite_for_request) para asignar scope_level = 'ORG' en el INSERT del
-- usuario ADMIN, cumpliendo chk_users_scope_admin_only.
-- Aplica backfill idempotente sobre ADMINs preexistentes sin scope.

BEGIN;

-- Redefinición: activate_organization_request
-- Crea la organización + el User admin PENDING_ACTIVATION cuando el visitante
-- consume el token enviado al aprobar la solicitud. El scope del admin es ORG
-- (cubre toda la organización recién creada; region_id queda NULL por defecto).
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
        first_name, last_name, scope_level
    ) VALUES (
        v_request.contact_email, v_username, p_password_hash, 'LOCAL'::auth_provider_type,
        'ADMIN'::user_role, 'PENDING_ACTIVATION'::user_status, v_org_id,
        TRUE, FALSE, TRUE, v_institutional_id, 'Administrador', '',
        'ORG'::user_scope_level
    )
    RETURNING id INTO v_user_id;

    UPDATE organization_requests
    SET activation_used = TRUE
    WHERE id = v_request.id;

    RETURN v_user_id;
END;
$$;

-- Redefinición: admin_invite_for_request
-- Crea el User admin + activation_token en la misma transacción que la
-- aprobación de la solicitud. Mismo contrato: scope ORG.
CREATE OR REPLACE FUNCTION admin_invite_for_request(
    p_request_id UUID,
    p_organization_id UUID
)
RETURNS TABLE(out_user_id UUID, out_raw_token TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_request_email TEXT;
    v_localpart TEXT;
    v_derived_username TEXT;
    v_derived_institutional_id TEXT;
    v_attempt INT := 0;
    v_user_id UUID;
    v_raw_token TEXT;
    v_token_hash TEXT;
BEGIN
    SELECT contact_email
      INTO v_request_email
      FROM public.organization_requests
     WHERE id = p_request_id
       AND status = 'APPROVED'
       AND reviewed_by IS NOT NULL
       FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Solicitud % no esta en estado APPROVED o no fue revisada.', p_request_id;
    END IF;

    v_localpart := lower(regexp_replace(split_part(v_request_email, '@', 1), '[^a-z0-9._-]', '', 'g'));
    IF length(v_localpart) = 0 THEN
        v_localpart := 'admin';
    END IF;

    v_derived_username := v_localpart;
    WHILE EXISTS (SELECT 1 FROM public.users WHERE username = v_derived_username) LOOP
        v_attempt := v_attempt + 1;
        v_derived_username := v_localpart || '_' || substr(md5(random()::text), 1, 4);
        IF v_attempt > 50 THEN
            RAISE EXCEPTION 'No fue posible generar un username unico tras 50 intentos.';
        END IF;
    END LOOP;

    v_derived_institutional_id := substr(
        v_localpart || '-ADMIN-' || upper(substr(md5(random()::text), 1, 4)),
        1, 30
    );

    INSERT INTO public.users (
        email,
        username,
        password,
        auth_provider,
        role,
        status,
        organization_id,
        is_verified,
        must_change_password,
        must_setup_2fa,
        institutional_id,
        first_name,
        last_name,
        scope_level
    ) VALUES (
        v_request_email,
        v_derived_username,
        NULL,
        'LOCAL'::auth_provider_type,
        'ADMIN'::user_role,
        'PENDING_ACTIVATION'::user_status,
        p_organization_id,
        FALSE,
        FALSE,
        TRUE,
        v_derived_institutional_id,
        'Administrador',
        '',
        'ORG'::user_scope_level
    )
    RETURNING id INTO v_user_id;

    v_raw_token := encode(gen_random_bytes(32), 'hex');
    v_token_hash := encode(digest(v_raw_token, 'sha256'), 'hex');

    INSERT INTO public.activation_tokens (
        user_id,
        token_hash,
        expires_at
    ) VALUES (
        v_user_id,
        v_token_hash,
        CURRENT_TIMESTAMP + INTERVAL '24 hours'
    );

    out_user_id := v_user_id;
    out_raw_token := v_raw_token;
    RETURN NEXT;
END;
$$;

-- Backfill idempotente: ADMINs ya creados sin scope quedan en ORG.
-- El filtro organization_id IS NOT NULL es defensivo: un ADMIN sin org ya
-- estaba bloqueado por chk_admin_requires_organization, así que solo
-- afectamos filas que ya cumplen el contrato previo.
UPDATE users
   SET scope_level = 'ORG'::user_scope_level
 WHERE role = 'ADMIN'::user_role
   AND scope_level IS NULL
   AND organization_id IS NOT NULL;

-- ACL (mismo patrón que las migraciones originales)
REVOKE ALL ON FUNCTION activate_organization_request(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION activate_organization_request(TEXT, TEXT) TO app_user;
REVOKE ALL ON FUNCTION admin_invite_for_request(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_invite_for_request(UUID, UUID) TO app_user;

COMMIT;