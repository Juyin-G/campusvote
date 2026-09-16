-- objections/001_candidacy_objections.sql
-- Tachas (fase SCHEDULED) e impugnaciones (fase CLOSED/CERTIFIED).
-- El tránsito de una elección a OPEN exige 0 tachas pendientes (service).
-- La resolución la realiza ADMIN/SUPERADMIN (SECURITY DEFINER).
-- Toda resolución queda registrada en audit_logs (service).

BEGIN;

DO $$ BEGIN
    CREATE TYPE objection_type AS ENUM (
        'TACHA_LIST', 'TACHA_CANDIDATE', 'IMPUGNACION_VOTE', 'IMPUGNACION_RESULT'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE objection_status AS ENUM ('PENDING', 'FOUNDED', 'UNFOUNDED', 'WITHDRAWN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS candidacy_objections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    election_id UUID NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
    candidate_list_id UUID NULL REFERENCES candidate_lists(id) ON DELETE CASCADE,
    candidacy_id UUID NULL REFERENCES candidacies(id) ON DELETE CASCADE,
    objection_type objection_type NOT NULL,
    reason TEXT NOT NULL,
    evidence_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
    filed_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    status objection_status NOT NULL DEFAULT 'PENDING',
    resolution_notes TEXT NULL,
    reviewed_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_objections_target CHECK (
        (candidate_list_id IS NOT NULL) <> (candidacy_id IS NOT NULL)
    ),
    CONSTRAINT chk_objections_reason_not_empty CHECK (length(trim(reason)) > 0),
    CONSTRAINT chk_objections_resolution CHECK (
        status NOT IN ('FOUNDED', 'UNFOUNDED') OR
        (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)
    )
);

-- Una sola tacha PENDING por lista y por candidato (revisión única).
CREATE UNIQUE INDEX IF NOT EXISTS uq_objections_one_pending_list
    ON candidacy_objections (election_id, candidate_list_id) WHERE status = 'PENDING';
CREATE UNIQUE INDEX IF NOT EXISTS uq_objections_one_pending_candidacy
    ON candidacy_objections (election_id, candidacy_id) WHERE status = 'PENDING';
CREATE INDEX IF NOT EXISTS idx_objections_election_status ON candidacy_objections (election_id, status);
CREATE INDEX IF NOT EXISTS idx_objections_candidate_list ON candidacy_objections (candidate_list_id);

DROP TRIGGER IF EXISTS trg_objections_updated_at ON candidacy_objections;
CREATE TRIGGER trg_objections_updated_at
BEFORE UPDATE ON candidacy_objections
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- VENTANA Y MÁQUINA DE ESTADOS DE LA OBJECIÓN
CREATE OR REPLACE FUNCTION enforce_objection_rules()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
    v_status election_status_type;
BEGIN
    SELECT status INTO v_status FROM elections WHERE id = COALESCE(NEW.election_id, OLD.election_id);
    IF v_status IS NULL THEN
        RAISE EXCEPTION 'Elección no encontrada para la objeción.';
    END IF;

    IF TG_OP = 'INSERT' THEN
        IF NEW.objection_type IN ('TACHA_LIST', 'TACHA_CANDIDATE') THEN
            IF v_status <> 'SCHEDULED' THEN
                RAISE EXCEPTION 'Las tachas solo se admiten durante la fase SCHEDULED (estado actual: %).', v_status;
            END IF;
        ELSIF v_status NOT IN ('CLOSED', 'CERTIFIED') THEN
            RAISE EXCEPTION 'Las impugnaciones solo se admiten en CLOSED/CERTIFIED (estado actual: %).', v_status;
        END IF;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        IF OLD.status <> 'PENDING' THEN
            RAISE EXCEPTION 'La objeción ya fue resuelta y no puede modificarse.';
        END IF;
        IF NEW.status NOT IN ('FOUNDED', 'UNFOUNDED', 'WITHDRAWN') THEN
            RAISE EXCEPTION 'La resolución debe ser FOUNDED, UNFOUNDED o WITHDRAWN.';
        END IF;
        NEW.reviewed_at := CURRENT_TIMESTAMP;
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_objections_status_rules ON candidacy_objections;
CREATE TRIGGER trg_objections_status_rules
BEFORE INSERT OR UPDATE ON candidacy_objections
FOR EACH ROW EXECUTE FUNCTION enforce_objection_rules();

COMMIT;