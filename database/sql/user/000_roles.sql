-- sql/user/000_roles.sql 
BEGIN;

-- 1. Crear el rol de la aplicación de forma segura e idempotente
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'app_user') THEN
        CREATE ROLE app_user WITH LOGIN;
    END IF;
END $$;

-- 2. Otorgar acceso al esquema
GRANT USAGE ON SCHEMA public TO app_user;

-- 3. Privilegios por defecto para TABLAS FUTURAS (Scripts 001 al 009)
ALTER DEFAULT PRIVILEGES IN SCHEMA public 
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;

-- 4. Privilegios por defecto para SECUENCIAS FUTURAS
ALTER DEFAULT PRIVILEGES IN SCHEMA public 
    GRANT USAGE, SELECT ON SEQUENCES TO app_user;

-- 5. Respaldos sobre tablas y secuencias existentes (por si se reejecuta)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;

COMMIT;