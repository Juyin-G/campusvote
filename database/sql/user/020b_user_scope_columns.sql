-- 020b_user_scope_columns.sql
-- Modelo de scope para usuarios ADMIN:
--   * scope_level: NULL para STUDENT/TEACHER/JURY; ORG/REGION/SITE solo para ADMIN.
--   * region_id: solo cuando scope_level = REGION.
--
-- Esta migración debe correr DESPUÉS de `organizations/006_organization_sites.sql`
-- (sitios existen) y ANTES del primer tenant CRUD que asigne scope.
--
-- Diseño compatible con el modelo Prisma User.scopeLevel/regionId.

-- 1. Nuevas columnas en users
ALTER TABLE users ADD COLUMN IF NOT EXISTS scope_level VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS region_id UUID;

-- 2. FK region_id -> regions
DO $fk_region$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_users_region') THEN
        ALTER TABLE users ADD CONSTRAINT fk_users_region
            FOREIGN KEY (region_id) REFERENCES regions(id)
            ON DELETE SET NULL;
    END IF;
END
$fk_region$;

-- 3. Índices
CREATE INDEX IF NOT EXISTS idx_users_scope_level ON users (scope_level);
CREATE INDEX IF NOT EXISTS idx_users_region ON users (region_id);

-- 4. CHECK de coherencia role/scope.
-- Solo ADMIN puede tener scope_level no nulo. Para STUDENT/TEACHER/JURY
-- y SUPERADMIN el scope debe ser NULL.
DO $chk_scope_admin$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_users_scope_admin_only') THEN
        ALTER TABLE users ADD CONSTRAINT chk_users_scope_admin_only
            CHECK (
                (role <> 'ADMIN'::user_role AND scope_level IS NULL AND region_id IS NULL)
                OR (role = 'ADMIN'::user_role AND scope_level IN ('ORG','REGION','SITE'))
            );
    END IF;
END
$chk_scope_admin$;

DO $chk_scope_region$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_users_scope_region_match') THEN
        ALTER TABLE users ADD CONSTRAINT chk_users_scope_region_match
            CHECK (
                (scope_level = 'ORG' AND region_id IS NULL)
                OR (scope_level = 'REGION' AND region_id IS NOT NULL)
                OR (scope_level = 'SITE' AND region_id IS NULL)
                OR (scope_level IS NULL AND region_id IS NULL)
            );
    END IF;
END
$chk_scope_region$;
