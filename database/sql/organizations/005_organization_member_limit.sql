BEGIN;

ALTER TABLE organizations
    ADD COLUMN IF NOT EXISTS member_limit INTEGER NOT NULL DEFAULT 100;

ALTER TABLE organizations
    DROP CONSTRAINT IF EXISTS chk_organizations_member_limit;

ALTER TABLE organizations
    ADD CONSTRAINT chk_organizations_member_limit
    CHECK (member_limit > 0 AND member_limit <= 1000000);

COMMIT;
