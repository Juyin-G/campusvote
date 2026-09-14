-- Local email/password authentication is the only supported provider.

BEGIN;

DROP INDEX IF EXISTS uq_users_google_id_active;
ALTER TABLE users DROP COLUMN IF EXISTS google_id;

-- La restricción fue creada cuando auth_provider era un enum. Debe
-- eliminarse antes de cambiar temporalmente la columna a TEXT.
ALTER TABLE users
    DROP CONSTRAINT IF EXISTS chk_users_password_required_for_local;

ALTER TABLE users
    ALTER COLUMN auth_provider DROP DEFAULT,
    ALTER COLUMN auth_provider TYPE TEXT USING auth_provider::text;

DROP TYPE IF EXISTS auth_provider_type;
CREATE TYPE auth_provider_type AS ENUM ('LOCAL');

ALTER TABLE users
    ALTER COLUMN auth_provider TYPE auth_provider_type
        USING auth_provider::auth_provider_type,
    ALTER COLUMN auth_provider SET DEFAULT 'LOCAL'::auth_provider_type;

ALTER TABLE users
    ADD CONSTRAINT chk_users_password_required_for_local
    CHECK (
      auth_provider <> 'LOCAL'::auth_provider_type
      OR status = 'PENDING_ACTIVATION'::user_status
      OR (password IS NOT NULL AND length(password) > 0)
    );

COMMIT;
