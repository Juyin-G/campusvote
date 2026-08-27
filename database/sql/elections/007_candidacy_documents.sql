-- src/database/sql/elections/007_candidacy_documents.sql

BEGIN;

-- 1. ENUM: TIPOS DE DOCUMENTOS (Por si acaso no se ha creado aún)
DO $$ BEGIN
    CREATE TYPE candidacy_document_type AS ENUM (
        'WORK_PLAN',   -- Plan de trabajo
        'CV',          -- Hoja de vida
        'ID_CARD',     -- DNI / Documento de identidad
        'OTHER'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. TABLA: DOCUMENTOS DE CANDIDATURA
CREATE TABLE IF NOT EXISTS candidacy_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidacy_id UUID NOT NULL REFERENCES candidacies(id) ON DELETE CASCADE,
    document_type candidacy_document_type NOT NULL,
    file_url TEXT NOT NULL, 
    file_hash CHAR(64) NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_candidacy_documents_type UNIQUE (candidacy_id, document_type),
    CONSTRAINT chk_candidacy_documents_hash CHECK (file_hash ~* '^[a-f0-9]{64}$'),
    CONSTRAINT chk_candidacy_documents_url_schema CHECK (file_url ~* '^https://'),
    CONSTRAINT chk_candidacy_documents_size CHECK (file_size_bytes > 0 AND file_size_bytes <= 10485760) -- Max 10MB
);

CREATE INDEX IF NOT EXISTS idx_candidacy_documents_candidacy 
    ON candidacy_documents (candidacy_id);

-- 3. TRIGGER: ENFORCE DOCUMENT IMMUTABILITY
CREATE OR REPLACE FUNCTION enforce_candidacy_document_immutability()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public, pg_temp AS $$
DECLARE
    v_election_status election_status_type;
    v_candidacy_status candidacy_status_type;
    v_target_candidacy_id UUID;
BEGIN
    -- Determinar el ID de la candidatura a validar (OLD para DELETE/UPDATE, NEW para INSERT)
    v_target_candidacy_id := COALESCE(OLD.candidacy_id, NEW.candidacy_id);

    -- Obtener estados actuales
    SELECT e.status, c.status 
    INTO v_election_status, v_candidacy_status
    FROM public.candidacies c
    JOIN public.elections e ON e.id = c.election_id
    WHERE c.id = v_target_candidacy_id;

    -- Validar bloqueo: Si la elección ya avanzó O la candidatura fue resuelta
    IF v_election_status NOT IN ('DRAFT', 'SCHEDULED') OR v_candidacy_status IN ('APPROVED', 'REJECTED') THEN
        RAISE EXCEPTION 'Operación rechazada: Los documentos de la candidatura % están bloqueados (Estado elección: %, Estado candidatura: %).', 
            v_target_candidacy_id, v_election_status, v_candidacy_status;
    END IF;

    -- Si es UPDATE y se intenta cambiar la candidatura de origen a una destino diferente
    IF TG_OP = 'UPDATE' AND NEW.candidacy_id IS DISTINCT FROM OLD.candidacy_id THEN
        SELECT e.status, c.status 
        INTO v_election_status, v_candidacy_status
        FROM public.candidacies c
        JOIN public.elections e ON e.id = c.election_id
        WHERE c.id = NEW.candidacy_id;

        IF v_election_status NOT IN ('DRAFT', 'SCHEDULED') OR v_candidacy_status IN ('APPROVED', 'REJECTED') THEN
            RAISE EXCEPTION 'Operación rechazada: No se puede mover el documento a la candidatura %, ya que está bloqueada.', NEW.candidacy_id;
        END IF;
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_candidacy_documents_lock ON candidacy_documents;
CREATE TRIGGER trg_candidacy_documents_lock
BEFORE INSERT OR UPDATE OR DELETE ON candidacy_documents
FOR EACH ROW EXECUTE FUNCTION enforce_candidacy_document_immutability();

-- 4. GOBERNANZA DE PERMISOS
GRANT SELECT, INSERT, UPDATE, DELETE ON candidacy_documents TO app_user;

COMMIT;