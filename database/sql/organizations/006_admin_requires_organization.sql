BEGIN;

-- Los SUPERADMIN son globales y pueden no tener tenant. Un ADMIN, en cambio,
-- siempre debe pertenecer a una organización.
ALTER TABLE users
    DROP CONSTRAINT IF EXISTS chk_admin_requires_organization;

ALTER TABLE users
    ADD CONSTRAINT chk_admin_requires_organization
    CHECK (role <> 'ADMIN' OR organization_id IS NOT NULL)
    NOT VALID;

COMMIT;
