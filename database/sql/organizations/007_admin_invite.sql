-- 007_admin_invite.sql
-- Crea el User admin + activation_token al aprobar una solicitud de organización.
-- Pensada para invocarse desde Node DESPUÉS de approve_organization_request,
-- en la misma transacción (BEGIN/COMMIT que envuelve la aprobación), o como
-- llamada dedicada si el caller maneja su propia transacción.

BEGIN;

-- FUNCIÓN: CREAR USUARIO ADMIN INVITADO + ACTIVATION TOKEN
--
-- Esta función se llama tras aprobar una solicitud. Inserta el User en
-- PENDING_ACTIVATION con rol ADMIN para la organización recién creada y
-- genera un activation_token de 24h.
--
-- Devuelve el raw_token (texto plano, una sola vez) que se envía por email al
-- visitante. El hash vive en activation_tokens.token_hash; el texto plano
-- nunca se vuelve a exponer al backend.
--
-- NO crea una Membership explícita porque la relación users.organizationId
-- cubre la pertenencia (consistente con el modelo Prisma Organization.users).
-- Si en una iteración futura se introduce memberships, ajustar aquí.

DROP FUNCTION IF EXISTS admin_invite_for_request(UUID, UUID);

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
    -- 1. Cargar email de la solicitud aprobada
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

    -- 2. Derivar username del email (parte local @)
    v_localpart := lower(regexp_replace(split_part(v_request_email, '@', 1), '[^a-z0-9._-]', '', 'g'));
    IF length(v_localpart) = 0 THEN
        v_localpart := 'admin';
    END IF;

    -- 3. Resolver colision de username (UNIQUE). Sufijo aleatorio si choca.
    v_derived_username := v_localpart;
    WHILE EXISTS (SELECT 1 FROM public.users WHERE username = v_derived_username) LOOP
        v_attempt := v_attempt + 1;
        v_derived_username := v_localpart || '_' || substr(md5(random()::text), 1, 4);
        IF v_attempt > 50 THEN
            RAISE EXCEPTION 'No fue posible generar un username unico tras 50 intentos.';
        END IF;
    END LOOP;

    -- 4. Generar institutionalId derivado. Patron: <localpart>-ADMIN-<4 hex>
    v_derived_institutional_id := substr(
        v_localpart || '-ADMIN-' || upper(substr(md5(random()::text), 1, 4)),
        1, 30
    );

    -- 5. Crear el User
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
        last_name
    ) VALUES (
        v_request_email,
        v_derived_username,
        NULL,                                       -- se define en /activate-account
        'LOCAL'::auth_provider_type,
        'ADMIN'::user_role,
        'PENDING_ACTIVATION'::user_status,
        p_organization_id,
        FALSE,
        FALSE,
        TRUE,                                       -- fuerza enrolamiento de TOTP en onboarding
        v_derived_institutional_id,
        'Administrador',
        ''
    )
    RETURNING id INTO v_user_id;

    -- 6. Crear activation_token (24h)
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

    -- 7. Devolver tabla
    out_user_id := v_user_id;
    out_raw_token := v_raw_token;
    RETURN NEXT;
END;
$$;

-- ACL
REVOKE ALL ON FUNCTION admin_invite_for_request(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_invite_for_request(UUID, UUID) TO app_user;

COMMIT;
