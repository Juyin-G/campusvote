-- Keeps local accounts without a password only while they are awaiting activation.

BEGIN;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS must_setup_2fa BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE users
    DROP CONSTRAINT IF EXISTS chk_users_password_required_for_local;

ALTER TABLE users
    ADD CONSTRAINT chk_users_password_required_for_local
    CHECK (
      auth_provider <> 'LOCAL'::auth_provider_type
      OR status = 'PENDING_ACTIVATION'::user_status
      OR (password IS NOT NULL AND length(password) > 0)
    );

COMMIT;
