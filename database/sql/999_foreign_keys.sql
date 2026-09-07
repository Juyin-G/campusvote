BEGIN;

-- OrganizationRequests -> Users (Revisor)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_org_requests_reviewed_by'
    ) THEN
        ALTER TABLE organization_requests
            ADD CONSTRAINT fk_org_requests_reviewed_by
            FOREIGN KEY (reviewed_by)
            REFERENCES users(id)
            ON DELETE SET NULL;
    END IF;
END $$;

-- Users -> Organizations
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_users_organization'
    ) THEN
        ALTER TABLE users
            ADD CONSTRAINT fk_users_organization
            FOREIGN KEY (organization_id)
            REFERENCES organizations(id)
            ON DELETE RESTRICT;
    END IF;
END $$;

-- Users -> Faculties
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_users_faculty'
    ) THEN
        ALTER TABLE users
            ADD CONSTRAINT fk_users_faculty
            FOREIGN KEY (faculty_id)
            REFERENCES faculties(id)
            ON DELETE SET NULL;
    END IF;
END $$;

-- Users -> Programs
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_users_program'
    ) THEN
        ALTER TABLE users
            ADD CONSTRAINT fk_users_program
            FOREIGN KEY (program_id)
            REFERENCES programs(id)
            ON DELETE SET NULL;
    END IF;
END $$;

-- Users -> Careers
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_users_career'
    ) THEN
        ALTER TABLE users
            ADD CONSTRAINT fk_users_career
            FOREIGN KEY (career_id)
            REFERENCES careers(id)
            ON DELETE SET NULL;
    END IF;
END $$;

COMMIT;