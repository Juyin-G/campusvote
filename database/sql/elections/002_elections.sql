-- 002_elections.sql (Consolidado)
BEGIN;

CREATE TABLE IF NOT EXISTS elections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL DEFAULT '',

    process_type election_process_type NOT NULL DEFAULT 'VOTE',
    scope_type election_scope_type NOT NULL,

    period_id UUID NOT NULL REFERENCES academic_periods(id) ON DELETE RESTRICT,
    faculty_id UUID NULL REFERENCES faculties(id) ON DELETE RESTRICT,
    program_id UUID NULL REFERENCES programs(id) ON DELETE RESTRICT,

    start_at TIMESTAMPTZ NOT NULL,
    end_at TIMESTAMPTZ NOT NULL,
    status election_status_type NOT NULL DEFAULT 'DRAFT',

    created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    form_structure JSONB NULL,
    is_anonymous_allowed BOOLEAN NOT NULL DEFAULT FALSE,

    CONSTRAINT chk_elections_dates CHECK (end_at > start_at),
    CONSTRAINT chk_elections_title_not_empty CHECK (length(trim(title)) > 0),
    
    CONSTRAINT chk_elections_scope_integrity CHECK (
        (scope_type = 'UNIVERSITY' AND faculty_id IS NULL AND program_id IS NULL) OR
        (scope_type = 'FACULTY' AND faculty_id IS NOT NULL AND program_id IS NULL) OR
        (scope_type = 'PROGRAM' AND faculty_id IS NOT NULL AND program_id IS NOT NULL)
    ),
    
    CONSTRAINT chk_elections_form_structure CHECK (
        process_type != 'FORM' OR (
            form_structure IS NOT NULL 
            AND form_structure != 'null'::jsonb 
            AND form_structure != '{}'::jsonb
        )
    )
);

-- ÍNDICES
CREATE INDEX IF NOT EXISTS idx_elections_status ON elections (status);
CREATE INDEX IF NOT EXISTS idx_elections_period ON elections (period_id);
CREATE INDEX IF NOT EXISTS idx_elections_faculty ON elections (faculty_id) WHERE faculty_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_elections_program ON elections (program_id) WHERE program_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_elections_created_by ON elections (created_by);

CREATE INDEX IF NOT EXISTS idx_elections_active_window
    ON elections (start_at, end_at)
    WHERE status = 'OPEN';

-- TRIGGERS Y FUNCIONES DE CONTROL

-- 1. Actualización de updated_at
DROP TRIGGER IF EXISTS trg_elections_updated_at ON elections;
CREATE TRIGGER trg_elections_updated_at
BEFORE UPDATE ON elections
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 2. Máquina de estados estricta
CREATE OR REPLACE FUNCTION validate_election_status_transition()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        IF NOT (
            (OLD.status = 'DRAFT'     AND NEW.status = 'SCHEDULED') OR
            (OLD.status = 'SCHEDULED' AND NEW.status = 'OPEN') OR
            (OLD.status = 'OPEN'      AND NEW.status = 'CLOSED') OR
            (OLD.status = 'CLOSED'    AND NEW.status = 'CERTIFIED') OR
            (OLD.status = 'CERTIFIED' AND NEW.status = 'PUBLISHED')
        ) THEN
            RAISE EXCEPTION 'Transición de estado inválida: % -> %', OLD.status, NEW.status;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_elections_status_transition ON elections;
CREATE TRIGGER trg_elections_status_transition
BEFORE UPDATE ON elections FOR EACH ROW EXECUTE FUNCTION validate_election_status_transition();

-- 3. Bloqueo de campos configurativos en vivo
CREATE OR REPLACE FUNCTION enforce_elections_core_lock()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
    IF OLD.status NOT IN ('DRAFT', 'SCHEDULED') THEN
        IF (OLD.scope_type IS DISTINCT FROM NEW.scope_type) OR
           (OLD.period_id IS DISTINCT FROM NEW.period_id) OR
           (OLD.faculty_id IS DISTINCT FROM NEW.faculty_id) OR
           (OLD.program_id IS DISTINCT FROM NEW.program_id) OR
           (OLD.start_at IS DISTINCT FROM NEW.start_at) OR
           (OLD.end_at IS DISTINCT FROM NEW.end_at) OR
           (OLD.title IS DISTINCT FROM NEW.title) OR
           (OLD.description IS DISTINCT FROM NEW.description) OR
           (OLD.form_structure IS DISTINCT FROM NEW.form_structure) OR
           (OLD.is_anonymous_allowed IS DISTINCT FROM NEW.is_anonymous_allowed) THEN
            RAISE EXCEPTION 'No se pueden alterar parámetros configurativos de una elección en estado %', OLD.status;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_elections_core_lock ON elections;
CREATE TRIGGER trg_elections_core_lock
BEFORE UPDATE ON elections FOR EACH ROW EXECUTE FUNCTION enforce_elections_core_lock();

-- 4. Prevención de borrado físico de la elección
CREATE OR REPLACE FUNCTION prevent_election_deletion()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
    IF OLD.status NOT IN ('DRAFT', 'SCHEDULED') THEN
        RAISE EXCEPTION 'Operación rechazada: No se puede eliminar la elección % en estado %. Utilice cancelación o archivado.', OLD.id, OLD.status;
    END IF;
    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_elections_prevent_deletion ON elections;
CREATE TRIGGER trg_elections_prevent_deletion
BEFORE DELETE ON elections FOR EACH ROW EXECUTE FUNCTION prevent_election_deletion();

-- 5. Función compartida de inmutabilidad estructural (consumida por tablas hijas)
CREATE OR REPLACE FUNCTION enforce_election_immutability()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
    v_status election_status_type;
    v_election_id UUID;
BEGIN
    v_election_id := COALESCE(NEW.election_id, OLD.election_id);

    SELECT status INTO v_status FROM public.elections WHERE id = v_election_id;

    IF v_status IS NULL OR v_status NOT IN ('DRAFT', 'SCHEDULED') THEN
        RAISE EXCEPTION 'Estructura bloqueada: La elección % está en estado % o no existe.', v_election_id, COALESCE(v_status::text, 'INEXISTENTE');
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$;

COMMIT;