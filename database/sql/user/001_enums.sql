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

COMMIT;