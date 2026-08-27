--src/database/sql/audit/002_audit_logs.sql

BEGIN;

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sequence_num BIGINT GENERATED ALWAYS AS IDENTITY,

    actor_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    election_id UUID NULL REFERENCES elections(id) ON DELETE SET NULL,

    action audit_action_type NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    ip_address INET NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

    previous_hash VARCHAR(64) NOT NULL DEFAULT '',
    current_hash VARCHAR(64) NOT NULL DEFAULT '',
    signature TEXT NOT NULL DEFAULT '',

    CONSTRAINT chk_audit_hashes_length CHECK (
        (previous_hash = '' OR length(previous_hash) = 64) AND
        (current_hash = '' OR length(current_hash) = 64)
    ),

    CONSTRAINT chk_audit_signature_if_hash CHECK (
        current_hash = '' OR length(trim(signature)) > 0
    ),

    CONSTRAINT chk_audit_anonymity CHECK (
        action != 'CAST_VOTE' OR (actor_id IS NULL AND ip_address IS NULL)
    ),

    CONSTRAINT chk_audit_metadata_no_identity CHECK (
        action != 'CAST_VOTE' OR NOT (
            metadata ? 'voter_email' OR 
            metadata ? 'voter_name' OR 
            metadata ? 'ip' OR 
            metadata ? 'user_id'
        )
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_audit_logs_sequence ON audit_logs (sequence_num);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_timestamp ON audit_logs (action, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_election_timestamp ON audit_logs (election_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_timestamp ON audit_logs (actor_id, timestamp DESC) WHERE actor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp_desc ON audit_logs (timestamp DESC);

COMMIT;