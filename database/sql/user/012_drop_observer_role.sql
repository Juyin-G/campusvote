-- user/012_drop_observer_role.sql
-- Elimina el rol OBSERVER del enum user_role en bases existentes.
--
-- PostgreSQL no permite ALTER TYPE ... DROP VALUE directamente, por lo que se
-- recrea el tipo sin el valor. El script es idempotente: si el enum ya no
-- contiene 'OBSERVER' (instalaciones nuevas creadas con 001_enums.sql
-- actualizado) no hace nada.
--
-- Si existen filas en users con role='OBSERVER', se aborta con un error
-- explícito: reasignar esos registros es una decisión de datos que se debe
-- tomar manualmente.


BEGIN;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_enum e
        JOIN pg_type t ON t.oid = e.enumtypid
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'user_role'
          AND n.nspname = 'public'
          AND e.enumlabel = 'OBSERVER'
    ) THEN
        RAISE NOTICE 'user_role ya no contiene OBSERVER; no se require migración.';
        RETURN;
    END IF;

    IF EXISTS (SELECT 1 FROM users WHERE role::text = 'OBSERVER') THEN
        RAISE EXCEPTION 'Existen usuarios con rol OBSERVER. Reasigna manualmente su rol antes de eliminar el valor del enum.';
    END IF;

    -- El CHECK chk_users_institutional_email referencia 'OBSERVER' y depende del
    -- tipo, por lo que se elimina y se vuelve a crear sin el valor eliminado.
    ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_users_institutional_email;

    ALTER TABLE users ALTER COLUMN role TYPE TEXT;

    DROP TYPE user_role;

    CREATE TYPE user_role AS ENUM (
        'STUDENT',
        'TEACHER',
        'ADMIN',
        'SUPERADMIN',
        'ELECTORAL_COMMISSION',
        'JURY'
    );

    ALTER TABLE users ALTER COLUMN role TYPE user_role USING role::user_role;

    ALTER TABLE users ADD CONSTRAINT chk_users_institutional_email CHECK (
        role IN ('ADMIN', 'SUPERADMIN', 'ELECTORAL_COMMISSION', 'JURY')
        OR email ~* '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.(edu\.pe|edu)$'
    );

    RAISE NOTICE 'Rol OBSERVER eliminado del enum user_role.';
END $$;

COMMIT;