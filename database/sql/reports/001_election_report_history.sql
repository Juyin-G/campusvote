BEGIN;

-- 1. TABLA: HISTORIAL DE GENERACIÓN DE ACTAS (PDF)
CREATE TABLE IF NOT EXISTS election_report_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    election_result_id UUID NOT NULL REFERENCES election_results(id) ON DELETE RESTRICT,
    generated_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    pdf_url TEXT NOT NULL,
    pdf_hash CHAR(64) NOT NULL,
    pdf_signature TEXT NOT NULL,
    template_version VARCHAR(50) NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_report_history_hash CHECK (pdf_hash ~* '^[a-f0-9]{64}$'),
    CONSTRAINT chk_report_history_size CHECK (file_size_bytes > 0),
    CONSTRAINT chk_report_history_url_schema CHECK (pdf_url ~* '^https://'),
    CONSTRAINT chk_report_history_signature_not_empty CHECK (length(trim(pdf_signature)) > 0),
    CONSTRAINT chk_report_history_template_not_empty CHECK (length(trim(template_version)) > 0)
);

-- ÍNDICES
CREATE INDEX IF NOT EXISTS idx_report_history_result ON election_report_history (election_result_id);
CREATE INDEX IF NOT EXISTS idx_report_history_generated_at ON election_report_history (generated_at DESC);

-- 2. TRIGGER DE INMUTABILIDAD (Hardened)
CREATE OR REPLACE FUNCTION prevent_report_history_modification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp AS $$
BEGIN
    RAISE EXCEPTION 'Operación no permitida: El historial de actas es inmutable.';
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_report_history_modification ON election_report_history;
CREATE TRIGGER trg_prevent_report_history_modification
BEFORE UPDATE OR DELETE ON election_report_history
FOR EACH ROW EXECUTE FUNCTION prevent_report_history_modification();

-- 3. FUNCIÓN: REGISTRAR NUEVA GENERACIÓN DE ACTA
CREATE OR REPLACE FUNCTION register_election_report_generation(
    p_election_result_id UUID,
    p_generated_by UUID,
    p_pdf_url TEXT,
    p_pdf_hash CHAR(64),
    p_pdf_signature TEXT,
    p_template_version VARCHAR(50),
    p_file_size_bytes BIGINT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_history_id UUID;
    v_user_role VARCHAR;
    v_result_exists BOOLEAN;
BEGIN
    -- 1. Validar existencia y bloquear fila en election_results para evitar condiciones de carrera
    SELECT EXISTS(
        SELECT 1 FROM election_results WHERE id = p_election_result_id FOR UPDATE
    ) INTO v_result_exists;

    IF NOT v_result_exists THEN
        RAISE EXCEPTION 'El registro de resultado electoral especificado no existe.';
    END IF;

    -- 2. Validar permisos (Solo Admin o Superadmin de plataforma)
    SELECT role INTO v_user_role FROM users WHERE id = p_generated_by AND status = 'ACTIVE';
    IF v_user_role IS NULL OR v_user_role NOT IN ('ADMIN', 'SUPERADMIN') THEN
        RAISE EXCEPTION 'Usuario no autorizado para generar actas oficiales.';
    END IF;

    -- 3. Insertar en el historial inmutable
    INSERT INTO election_report_history (
        election_result_id, generated_by, pdf_url, pdf_hash, 
        pdf_signature, template_version, file_size_bytes
    ) VALUES (
        p_election_result_id, p_generated_by, p_pdf_url, p_pdf_hash, 
        p_pdf_signature, trim(p_template_version), p_file_size_bytes
    ) RETURNING id INTO v_history_id;

    -- 4. Actualizar la tabla maestra de resultados con la versión más reciente
    UPDATE election_results
    SET 
        report_pdf = p_pdf_url,
        report_hash = p_pdf_hash,
        report_signature = p_pdf_signature,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_election_result_id;

    RETURN v_history_id;
END;
$$;

-- 4. PERMISOS Y GOBERNANZA
REVOKE ALL ON FUNCTION register_election_report_generation(UUID, UUID, TEXT, CHAR(64), TEXT, VARCHAR(50), BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION register_election_report_generation(UUID, UUID, TEXT, CHAR(64), TEXT, VARCHAR(50), BIGINT) TO app_user;

GRANT SELECT ON election_report_history TO app_user;
REVOKE INSERT, UPDATE, DELETE ON election_report_history FROM app_user;

COMMIT;