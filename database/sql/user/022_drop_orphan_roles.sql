-- 022_drop_orphan_roles.sql
-- Limpia el enum user_role para eliminar OBSERVER y ELECTORAL_COMMISSION.
-- Pre-condición: ninguna fila debe tener esos roles.
--
-- Postgres no permite DROP VALUE de un enum directamente. Esta migración:
--   1. Elimina los CHECK constraints que comparan contra user_role.
--   2. Elimina los índices parciales WHERE (role = 'STUDENT'::user_role).
--   3. DROP DEFAULT, ALTER COLUMN role TYPE TEXT, DROP TYPE user_role,
--      CREATE TYPE user_role (limpio), ALTER COLUMN role TYPE user_role,
--      SET DEFAULT.
--   4. Recrea los CHECK constraints (sin OBSERVER/ELECTORAL_COMMISSION).
--   5. Recrea los índices parciales.
--
-- Usa role::text en las guardas para evitar casteo al enum (que fallaría
-- si OBSERVER/ELECTORAL_COMMISSION ya no existen en el enum).

DO $$
BEGIN
    -- No abortar si ya está limpio: verificamos contra pg_enum directamente.
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum e
          JOIN pg_type t ON t.oid = e.enumtypid
         WHERE t.typname = 'user_role'
           AND e.enumlabel IN ('OBSERVER', 'ELECTORAL_COMMISSION')
    ) THEN
        RAISE NOTICE 'user_role ya está limpio. No se hace nada.';
        RETURN;
    END IF;
END
$$;

-- Guardia tolerante: usa role::text para evitar casteo al enum.
DO $$
DECLARE
    v_orphan_count INT;
BEGIN
    SELECT COUNT(*) INTO v_orphan_count
      FROM users
     WHERE role::text IN ('OBSERVER', 'ELECTORAL_COMMISSION');

    IF v_orphan_count > 0 THEN
        RAISE EXCEPTION
          'Hay % fila(s) con role OBSERVER/ELECTORAL_COMMISSION. Migra los datos antes de aplicar este script.',
          v_orphan_count;
    END IF;
END
$$;

-- Paso 1: DROP constraints
-- Cualquier CHECK que mencione role se retira antes de cambiar el tipo, no
-- solo los que se recrean abajo. Las bases creadas cuando user_role aún tenía
-- OBSERVER tienen además chk_users_role_not_observer (user/012, retirado):
-- con role como TEXT, PostgreSQL guarda `role::text <> 'OBSERVER'` como
-- `role <> 'OBSERVER'::text`, y al volver a user_role el ALTER falla con
-- "operator does not exist: user_role <> text". Esa regla ya no hace falta:
-- el tipo nuevo no tiene OBSERVER.
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT conname
          FROM pg_constraint
         WHERE conrelid = 'public.users'::regclass
           AND contype = 'c'
           AND pg_get_constraintdef(oid) ~* '\mrole\M'
    LOOP
        EXECUTE format('ALTER TABLE users DROP CONSTRAINT %I', r.conname);
    END LOOP;
END
$$;

ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_admin_requires_organization;
ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_users_academic_linkage;
ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_users_institutional_email;
ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_users_scope_admin_only;
ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_users_student_data;
ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_users_teacher_data;

-- Paso 2: DROP índices parciales
DROP INDEX IF EXISTS idx_users_program_status_student;
DROP INDEX IF EXISTS idx_users_faculty_status_student;
DROP INDEX IF EXISTS idx_users_program_cycle_student;

-- Paso 3: ALTER COLUMN + DROP/CREATE TYPE
ALTER TABLE users ALTER COLUMN role DROP DEFAULT;
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
ALTER TABLE users ALTER COLUMN role SET DEFAULT 'STUDENT'::user_role;

-- Paso 4: recrear constraints
ALTER TABLE users
    ADD CONSTRAINT chk_admin_requires_organization
    CHECK (role <> 'ADMIN' OR organization_id IS NOT NULL) NOT VALID;

ALTER TABLE users
    ADD CONSTRAINT chk_users_academic_linkage
    CHECK (
        CASE WHEN role = 'TEACHER' THEN faculty_id IS NOT NULL ELSE TRUE END
    ) NOT VALID;
-- NOT VALID: no revisa las filas existentes. Las bases que ya aplicaron
-- user/016 tienen docentes sin facultad y el ALTER fallaría. La regla la
-- vuelve a retirar user/023, que corre después.

ALTER TABLE users
    ADD CONSTRAINT chk_users_institutional_email
    CHECK (
        role IN ('ADMIN', 'SUPERADMIN', 'JURY')
        OR email ~* '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.(edu\.pe|edu)$'
    );

ALTER TABLE users
    ADD CONSTRAINT chk_users_scope_admin_only
    CHECK (
        (role <> 'ADMIN' AND scope_level IS NULL AND region_id IS NULL)
        OR (role = 'ADMIN' AND scope_level IS NOT NULL)
    );

ALTER TABLE users
    ADD CONSTRAINT chk_users_student_data
    CHECK (
        role <> 'STUDENT'
        OR current_cycle IS NULL
        OR (current_cycle BETWEEN 1 AND 20)
    );

ALTER TABLE users
    ADD CONSTRAINT chk_users_teacher_data
    CHECK (
        role = 'TEACHER'
        OR (specialty IS NULL AND department IS NULL)
    );

-- Paso 5: recrear índices parciales
CREATE INDEX idx_users_program_status_student
    ON public.users USING btree (program_id, status)
    WHERE (role = 'STUDENT'::user_role);

CREATE INDEX idx_users_faculty_status_student
    ON public.users USING btree (faculty_id, status)
    WHERE (role = 'STUDENT'::user_role);

CREATE INDEX idx_users_program_cycle_student
    ON public.users USING btree (program_id, current_cycle)
    WHERE ((role = 'STUDENT'::user_role) AND (status = 'ACTIVE'::user_status));