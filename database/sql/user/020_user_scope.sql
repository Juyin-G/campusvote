-- 020_user_scope.sql
-- Modelo de scope para usuarios ADMIN:
--   - scope_level: NULL para STUDENT/TEACHER/JURY; ORG/REGION/SITE solo para ADMIN.
--   - region_id: solo cuando scope_level = REGION (la región del ADMIN).
--   - tabla puente user_site_assignments: filas para scope_level = SITE
--     (una o varias sedes asignadas al ADMIN).
--
-- Reglas de integridad (CHECK):
--   * ADMIN sin scope_level: NO permitido (debe tener ORG/REGION/SITE explícito).
--   * scope_level = ORG      → region_id IS NULL.
--   * scope_level = REGION  → region_id IS NOT NULL.
--   * scope_level = SITE     → region_id IS NULL (las sedes viven en user_site_assignments).
--   * otros roles → scope_level IS NULL.
--
-- También aprovecha este script para ELIMINAR ELECTORAL_COMMISSION del enum
-- user_role (mismo patrón que 012_drop_observer_role.sql): recrea el enum sin
-- el valor y actualiza los CHECKs que lo referencian.

BEGIN;

DO $$
DECLARE
    has_ec BOOLEAN;
    has_ec_users BOOLEAN;
BEGIN
    -- 1. ¿Existe ELECTORAL_COMMISSION en el enum?
    SELECT EXISTS (
        SELECT 1 FROM pg_enum e
        JOIN pg_type t ON t.oid = e.enumtypid
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'user_role' AND n.nspname = 'public' AND e.enumlabel = 'ELECTORAL_COMMISSION'
    ) INTO has_ec;

    -- 2. ¿Hay usuarios activos con ese rol?
    IF has_ec THEN
        SELECT EXISTS (SELECT 1 FROM users WHERE role::text = 'ELECTORAL_COMMISSION')
            INTO has_ec_users;

        IF has_ec_users THEN
            RAISE EXCEPTION 'Existen usuarios con rol ELECTORAL_COMMISSION. Reasignar manualmente su rol antes de eliminar el valor del enum.';
        END IF;

        -- 3. Soltar CHECKs que referencian el valor eliminado.
        ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_users_institutional_email;

        -- 4. Recrear el enum sin ELECTORAL_COMMISSION.
        ALTER TABLE users ALTER COLUMN role TYPE TEXT;
        DROP TYPE user_role;
        CREATE TYPE user_role AS ENUM (
            'STUDENT',
            'TEACHER',
            'ADMIN',
            'SUPERADMIN',
            'JURY'
        );
        ALTER TABLE users ALTER COLUMN role TYPE user_role USING role::user_role;
    ELSE
        RAISE NOTICE 'user_role ya no contiene ELECTORAL_COMMISSION; no se requiere migración.';
    END IF;
END $$;

-- 5. Nuevas columnas en users
ALTER TABLE users ADD COLUMN IF NOT EXISTS scope_level VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS region_id UUID;

-- 6. FK region_id → regions
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_users_region') THEN
        ALTER TABLE users ADD CONSTRAINT fk_users_region
            FOREIGN KEY (region_id) REFERENCES regions(id)
            ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_scope_level ON users (scope_level);
CREATE INDEX IF NOT EXISTS idx_users_region ON users (region_id);

-- 7. CHECK de coherencia role/scope
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_users_scope_admin_only') THEN
        ALTER TABLE users ADD CONSTRAINT chk_users_scope_admin_only
            CHECK (
                (role <> 'ADMIN' AND scope_level IS NULL AND region_id IS NULL)
                OR (role = 'ADMIN' AND scope_level IN ('ORG','REGION','SITE'))
            );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_users_scope_region_match') THEN
        ALTER TABLE users ADD CONSTRAINT chk_users_scope_region_match
            CHECK (
                (scope_level = 'ORG' AND region_id IS NULL)
                OR (scope_level = 'REGION' AND region_id IS NOT NULL)
                OR (scope_level = 'SITE' AND region_id IS NULL)
                OR (scope_level IS NULL AND region_id IS NULL)
            );
    END IF;
END $$;

-- 8. Nuevo CHECK institucional del email (sin ELECTORAL_COMMISSION)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_users_institutional_email') THEN
        ALTER TABLE users ADD CONSTRAINT chk_users_institutional_email
            CHECK (
                role IN ('ADMIN', 'SUPERADMIN', 'JURY')
                OR email ~* '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.(edu\.pe|edu)$'
            );
    END IF;
END $$;

-- 9. Actualizar CHECK chk_users_academic_linkage: ADMIN no requiere faculty_id
--    pero TEACHER sí.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_users_academic_linkage') THEN
        ALTER TABLE users ADD CONSTRAINT chk_users_academic_linkage
            CHECK (
                CASE
                    WHEN role = 'TEACHER' THEN faculty_id IS NOT NULL
                    ELSE TRUE
                END
            );
    END IF;
END $$;

COMMIT;
