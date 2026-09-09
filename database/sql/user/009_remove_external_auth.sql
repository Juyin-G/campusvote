-- 009_remove_external_auth.sql
-- The platform uses local email/password authentication only.

BEGIN;

DROP INDEX IF EXISTS uq_users_google_id_active;
ALTER TABLE users DROP COLUMN IF EXISTS google_id;

ALTER TABLE users
    ALTER COLUMN auth_provider DROP DEFAULT,
    ALTER COLUMN auth_provider TYPE TEXT USING auth_provider::text;

DROP TYPE IF EXISTS auth_provider_type;
CREATE TYPE auth_provider_type AS ENUM ('LOCAL');

ALTER TABLE users
    ALTER COLUMN auth_provider TYPE auth_provider_type
        USING auth_provider::auth_provider_type,
    ALTER COLUMN auth_provider SET DEFAULT 'LOCAL'::auth_provider_type;

COMMIT;
