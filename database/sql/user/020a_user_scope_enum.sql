-- 020a_user_scope_enum.sql
-- Creates the user_scope_level enum type required by Prisma schema.

BEGIN;

DO $create_scope_enum$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_scope_level') THEN
        CREATE TYPE user_scope_level AS ENUM ('ORG', 'REGION', 'SITE');
    END IF;
END
$create_scope_enum$;

COMMIT;
