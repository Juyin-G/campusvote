BEGIN;

-- TABLA: ONE TIME TOKENS (HASHEADOS EN REPOSO)

CREATE TABLE IF NOT EXISTS one_time_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    token_hash VARCHAR(64) NOT NULL UNIQUE,

    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    election_id UUID NOT NULL REFERENCES elections(id) ON DELETE CASCADE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ NULL,

    CONSTRAINT chk_ott_hash_length CHECK (length(token_hash) = 64),
    CONSTRAINT chk_ott_expires_after_created CHECK (expires_at > created_at),
    CONSTRAINT chk_ott_used_timeframe CHECK (
        used_at IS NULL OR used_at >= created_at
    )
);

-- ÍNDICES: ONE TIME TOKENS

CREATE INDEX IF NOT EXISTS idx_ott_user_election
    ON one_time_tokens (user_id, election_id);

CREATE INDEX IF NOT EXISTS idx_ott_election
    ON one_time_tokens (election_id);

CREATE INDEX IF NOT EXISTS idx_ott_expires_pending
    ON one_time_tokens (expires_at)
    WHERE used_at IS NULL;

-- Evita múltiples tokens activos para un mismo elector y elección
CREATE UNIQUE INDEX IF NOT EXISTS uq_ott_user_election_active
    ON one_time_tokens (user_id, election_id)
    WHERE used_at IS NULL;

COMMIT;