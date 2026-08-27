-- 001_enums.sql (Refactorizado)

BEGIN;

-- ENUM: ROLES DE USUARIO
DO $$
BEGIN
    CREATE TYPE user_role AS ENUM (
        'STUDENT',
        'TEACHER',
        'ADMIN',
        'ELECTORAL_COMMISSION',
        'OBSERVER'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ENUM: PROVEEDORES DE AUTENTICACIÓN
DO $$
BEGIN
    CREATE TYPE auth_provider_type AS ENUM (
        'LOCAL',
        'GOOGLE',
        'AWS'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ENUM: ESTADO DE USUARIO 
DO $$
BEGIN
    CREATE TYPE user_status AS ENUM (
        'PENDING', 
        'ACTIVE', 
        'SUSPENDED', 
        'DELETED'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ENUM: TIPO DE AVATAR
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'avatar_type') THEN
        CREATE TYPE avatar_type AS ENUM ('DEFAULT_DICEBEAR', 'UPLOADED', 'GRAVATAR');
    END IF;
END $$;

COMMIT;