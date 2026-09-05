BEGIN;

DO $$ BEGIN
  CREATE TYPE jury_assignment_status AS ENUM ('ACTIVE', 'REVOKED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE jury_conflict_status AS ENUM ('OPEN', 'CLEARED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS jury_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id UUID NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
  candidacy_id UUID NOT NULL REFERENCES candidacies(id) ON DELETE CASCADE,
  juror_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  assigned_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status jury_assignment_status NOT NULL DEFAULT 'ACTIVE',
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_jury_assignments_candidacy_juror UNIQUE (candidacy_id, juror_id)
);

CREATE INDEX IF NOT EXISTS idx_jury_assignments_election_juror
  ON jury_assignments (election_id, juror_id, status);

CREATE TABLE IF NOT EXISTS jury_conflicts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id UUID NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
  candidacy_id UUID NOT NULL REFERENCES candidacies(id) ON DELETE CASCADE,
  juror_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  reason VARCHAR(500) NOT NULL CHECK (length(trim(reason)) > 0),
  status jury_conflict_status NOT NULL DEFAULT 'OPEN',
  declared_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  resolved_by UUID REFERENCES users(id) ON DELETE RESTRICT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_jury_conflicts_scope UNIQUE (election_id, candidacy_id, juror_id)
);

CREATE INDEX IF NOT EXISTS idx_jury_conflicts_election_status
  ON jury_conflicts (election_id, status);

DROP TRIGGER IF EXISTS trg_jury_assignments_updated_at ON jury_assignments;
CREATE TRIGGER trg_jury_assignments_updated_at
BEFORE UPDATE ON jury_assignments FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_jury_conflicts_updated_at ON jury_conflicts;
CREATE TRIGGER trg_jury_conflicts_updated_at
BEFORE UPDATE ON jury_conflicts FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;
