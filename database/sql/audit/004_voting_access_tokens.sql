-- src/database/sql/audit/004_voting_access_tokens.sql

BEGIN;

CREATE TABLE IF NOT EXISTS voting_access_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    token_hash VARCHAR(64) NOT NULL UNIQUE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    election_id UUID NOT NULL REFERENCES elections(id) ON DELETE CASCADE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ NULL,

    CONSTRAINT chk_vat_hash_length CHECK (length(token_hash) = 64),
    CONSTRAINT chk_vat_expires_after_created CHECK (expires_at > created_at),
    CONSTRAINT chk_vat_used_timeframe CHECK (used_at IS NULL OR used_at >= created_at)
);

CREATE INDEX IF NOT EXISTS idx_vat_user_election ON voting_access_tokens (user_id, election_id);
CREATE INDEX IF NOT EXISTS idx_vat_election ON voting_access_tokens (election_id);
CREATE INDEX IF NOT EXISTS idx_vat_expires_pending ON voting_access_tokens (expires_at) WHERE used_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_vat_user_election_active
    ON voting_access_tokens (user_id, election_id)
    WHERE used_at IS NULL;

COMMIT;