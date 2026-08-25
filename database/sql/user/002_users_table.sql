BEGIN;

-- TABLA: USERS

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Autenticación
    password VARCHAR(255) NULL,
    auth_provider auth_provider_type NOT NULL DEFAULT 'LOCAL',
    google_id VARCHAR(255) NULL,

    -- Sesión
    last_login TIMESTAMPTZ NULL,
    is_superuser BOOLEAN NOT NULL DEFAULT FALSE,

    -- Datos personales
    username CITEXT NOT NULL,
    first_name VARCHAR(150) NOT NULL DEFAULT '',
    last_name VARCHAR(150) NOT NULL DEFAULT '',
    email CITEXT NOT NULL,

    -- Estado
    is_staff BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    date_joined TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Identidad institucional
    institutional_id CITEXT NOT NULL,
    role user_role NOT NULL DEFAULT 'STUDENT',
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    is_biometric_verified BOOLEAN NOT NULL DEFAULT FALSE,

    -- Tenant
    organization_id UUID NULL
        REFERENCES organizations(id)
        ON DELETE RESTRICT,

    -- 2FA
    two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    two_factor_secret VARCHAR(255) NULL,
    two_factor_backup_codes JSONB NOT NULL DEFAULT '[]'::jsonb,

    -- Password policy
    must_change_password BOOLEAN NOT NULL DEFAULT TRUE,

    -- Seguridad y auditoría
    failed_login_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ NULL,
    password_changed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Restricciones Únicas
    CONSTRAINT uq_users_username UNIQUE (username),
    CONSTRAINT uq_users_email UNIQUE (email),
    CONSTRAINT uq_users_institutional_id UNIQUE (institutional_id),
    CONSTRAINT uq_users_google_id UNIQUE (google_id),

    -- Checks de validación
    CONSTRAINT chk_users_username_not_empty
        CHECK (length(trim(username::text)) > 0),

    CONSTRAINT chk_users_institutional_id_not_empty
        CHECK (length(trim(institutional_id::text)) > 0),

    CONSTRAINT chk_users_password_required_for_local
        CHECK (
            auth_provider != 'LOCAL'
            OR (password IS NOT NULL AND length(password) > 0)
        ),

    CONSTRAINT chk_users_superuser_requires_staff
        CHECK (is_superuser = FALSE OR is_staff = TRUE),

    CONSTRAINT chk_users_failed_login_attempts_non_negative
        CHECK (failed_login_attempts >= 0)
);

COMMIT;