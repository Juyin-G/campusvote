-- 002_users_table.sql (Versión Final Corregida)

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
    avatar_url VARCHAR(500) NULL,
    avatar_type avatar_type NOT NULL DEFAULT 'DEFAULT_DICEBEAR',

    -- Estado 
    is_staff BOOLEAN NOT NULL DEFAULT FALSE,
    status user_status NOT NULL DEFAULT 'PENDING', 
    date_joined TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Identidad institucional
    institutional_id CITEXT NOT NULL,
    role user_role NOT NULL DEFAULT 'STUDENT',
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,

    -- Tenant y Contexto Académico General (FKs gestionadas en 999_foreign_keys.sql)
    organization_id UUID NULL,
    faculty_id UUID NULL,
    program_id UUID NULL,
    career_id UUID NULL,

    -- PERFILES ESPECÍFICOS 

    -- Data exclusiva de Estudiantes
    current_cycle INTEGER NULL CHECK (current_cycle BETWEEN 1 AND 20),
    admission_period_id UUID NULL, 
    
    -- Data exclusiva de Docentes
    specialty VARCHAR(255) NULL,
    department VARCHAR(255) NULL,

    -- Auditoría de Cambios (Relaciones a la misma tabla users)
    last_role_change_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    last_role_change_at TIMESTAMPTZ NULL,
    last_status_change_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    last_status_change_at TIMESTAMPTZ NULL,
    status_change_reason VARCHAR(255) NULL,

    -- 2FA (Hashes y cifrado manejados en capa de aplicación)
    two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    two_factor_secret VARCHAR(500) NULL, 
    two_factor_backup_codes JSONB NOT NULL DEFAULT '[]'::jsonb,

    -- Password policy
    must_change_password BOOLEAN NOT NULL DEFAULT TRUE,

    -- Seguridad general
    failed_login_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ NULL,
    password_changed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Auditoría de Sesión Última
    last_login_ip VARCHAR(45) NULL,
    last_login_user_agent TEXT NULL,

    -- CHECKS DE VALIDACIÓN Y REGLAS DE NEGOCIO
    CONSTRAINT chk_users_username_not_empty CHECK (length(trim(username::text)) > 0),
    CONSTRAINT chk_users_institutional_id_not_empty CHECK (length(trim(institutional_id::text)) > 0),
    CONSTRAINT chk_users_password_required_for_local CHECK (auth_provider != 'LOCAL' OR (password IS NOT NULL AND length(password) > 0)),
    CONSTRAINT chk_users_superuser_requires_staff CHECK (is_superuser = FALSE OR is_staff = TRUE),
    CONSTRAINT chk_users_failed_login_attempts_non_negative CHECK (failed_login_attempts >= 0),
    CONSTRAINT chk_users_institutional_email CHECK (
        role IN ('ADMIN', 'SUPERADMIN', 'ELECTORAL_COMMISSION', 'JURY') 
        OR email ~* '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.(edu\.pe|edu)$'
    ),
    -- El vínculo académico (carrera/programa y facultad) se asigna por el ADMIN
    -- o se deriva del código institucional al registrarse; por eso no se exige
    -- al momento de la creación del usuario.
    CONSTRAINT chk_users_academic_linkage CHECK (
        CASE 
            WHEN role = 'TEACHER' THEN faculty_id IS NOT NULL
            ELSE TRUE
        END
    ),

    -- Reglas para el perfil Estudiante: ciclo y periodo son opcionales al crear,
    -- el ADMIN los configura (o se parsean del código institucional).
    CONSTRAINT chk_users_student_data 
        CHECK (
            role != 'STUDENT' 
            OR current_cycle IS NULL
            OR (current_cycle BETWEEN 1 AND 20)
        ),

    -- Reglas estrictas para el perfil Docente
    CONSTRAINT chk_users_teacher_data 
        CHECK (
            role = 'TEACHER' 
            OR 
            (specialty IS NULL AND department IS NULL)
        )
);

GRANT SELECT, INSERT, UPDATE, DELETE ON users TO app_user;

COMMIT;