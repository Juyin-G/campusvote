BEGIN;

-- ÍNDICES: USERS

CREATE INDEX IF NOT EXISTS idx_users_organization_id
    ON users (organization_id);

CREATE INDEX IF NOT EXISTS idx_users_role
    ON users (role);

CREATE INDEX IF NOT EXISTS idx_users_organization_role_active
    ON users (organization_id, role)
    WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_users_date_joined_desc
    ON users (date_joined DESC);

CREATE INDEX IF NOT EXISTS idx_users_locked_until
    ON users (locked_until)
    WHERE locked_until IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_login_lookup
    ON users (email)
    WHERE is_active = TRUE;

COMMIT;

