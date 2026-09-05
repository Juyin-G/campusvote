-- ratings/003_jury_assignments.sql
-- Asignación explícita de jurados a proyectos (doble ciego + declaración de
-- conflicto de interés). Solo jurados con asignación ACTIVA pueden calificar.

BEGIN;

DO $$ BEGIN
    CREATE TYPE jury_assignment_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS jury_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    election_id UUID NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
    candidacy_id UUID NOT NULL REFERENCES candidacies(id) ON DELETE CASCADE,
    jury_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    status jury_assignment_status NOT NULL DEFAULT 'PENDING',
    is_diriment BOOLEAN NOT NULL DEFAULT FALSE,
    conflict_declaration BOOLEAN NOT NULL DEFAULT FALSE,
    declared_at TIMESTAMPTZ NULL,
    assigned_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_jury_assignments_election_candidacy_jury UNIQUE (election_id, candidacy_id, jury_id)
);

CREATE INDEX IF NOT EXISTS idx_jury_assignments_jury ON jury_assignments (jury_id);
CREATE INDEX IF NOT EXISTS idx_jury_assignments_candidacy ON jury_assignments (candidacy_id);

DROP TRIGGER IF EXISTS trg_jury_assignments_updated_at ON jury_assignments;
CREATE TRIGGER trg_jury_assignments_updated_at
BEFORE UPDATE ON jury_assignments
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Asignaciones solo mientras la feria está en DRAFT/SCHEDULED. La firma de la
-- declaración de conflicto es precondición para calificar (se valida en service).
DROP TRIGGER IF EXISTS trg_jury_assignments_immutability ON jury_assignments;
CREATE TRIGGER trg_jury_assignments_immutability
BEFORE INSERT OR UPDATE OR DELETE ON jury_assignments
FOR EACH ROW EXECUTE FUNCTION enforce_election_immutability();

COMMIT;