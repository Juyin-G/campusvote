-- 001_voting_sessions.sql (Refactorizado)
BEGIN;

CREATE TABLE IF NOT EXISTS voting_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    election_id UUID NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
    voter_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,

    started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMPTZ NULL,

    ip_address INET NULL,
    user_agent TEXT NULL,

    is_successful BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_session_completed_if_successful CHECK (
        is_successful = FALSE OR completed_at IS NOT NULL
    ),
    CONSTRAINT chk_session_completed_after_started CHECK (
        completed_at IS NULL OR completed_at >= started_at
    ),
    CONSTRAINT chk_session_user_agent_not_empty CHECK (
        user_agent IS NULL OR length(trim(user_agent)) > 0
    )
);

CREATE INDEX IF NOT EXISTS idx_voting_sessions_voter ON voting_sessions (voter_id);
CREATE INDEX IF NOT EXISTS idx_voting_sessions_election ON voting_sessions (election_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_voting_sessions_active_user
    ON voting_sessions (election_id, voter_id)
    WHERE completed_at IS NULL;

DROP TRIGGER IF EXISTS trg_voting_sessions_updated_at ON voting_sessions;
CREATE TRIGGER trg_voting_sessions_updated_at
BEFORE UPDATE ON voting_sessions
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

COMMIT;