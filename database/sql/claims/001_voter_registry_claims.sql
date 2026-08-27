-- src/database/sql/claims/001_voter_registry_claims.sql

BEGIN;

DO $$ BEGIN
    CREATE TYPE voter_claim_type AS ENUM (
        'MISSING_FROM_REGISTRY', 
        'INCORRECT_DATA',        
        'INELIGIBLE_MARKED_ELIGIBLE' 
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE voter_claim_status AS ENUM (
        'PENDING',
        'APPROVED',
        'REJECTED'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS voter_registry_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    period_id UUID NOT NULL REFERENCES academic_periods(id) ON DELETE RESTRICT,
    claim_type voter_claim_type NOT NULL,
    description TEXT NOT NULL,
    supporting_document_url TEXT NULL, -- Cambiado de VARCHAR(500) a TEXT
    status voter_claim_status NOT NULL DEFAULT 'PENDING',
    reviewed_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ NULL,
    resolution_notes TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_claim_description_not_empty CHECK (length(trim(description)) > 0)
    -- Se elimina uq_voter_claims_user_period_pending de la tabla
);

-- Índice único parcial: Solo 1 reclamo PENDING activo por usuario por periodo
CREATE UNIQUE INDEX IF NOT EXISTS uq_voter_claims_one_pending_per_user_period
ON voter_registry_claims (user_id, period_id)
WHERE status = 'PENDING';

CREATE INDEX IF NOT EXISTS idx_voter_claims_period_status ON voter_registry_claims (period_id, status);

-- FUNCIÓN: RESOLVER RECLAMO DE PADRÓN
CREATE OR REPLACE FUNCTION resolve_voter_registry_claim(
    p_claim_id UUID,
    p_reviewer_user_id UUID,
    p_new_status voter_claim_status,
    p_resolution_notes TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_claim RECORD;
    v_reviewer_is_staff BOOLEAN;
BEGIN
    -- Validar que el nuevo estado sea terminal
    IF p_new_status NOT IN ('APPROVED', 'REJECTED') THEN
        RAISE EXCEPTION 'El nuevo estado debe ser APPROVED o REJECTED.';
    END IF;

    -- 1. Validar permisos del revisor
    SELECT is_staff INTO v_reviewer_is_staff FROM users WHERE id = p_reviewer_user_id AND status = 'ACTIVE';
    IF NOT FOUND OR v_reviewer_is_staff IS NOT TRUE THEN
        RAISE EXCEPTION 'Usuario no autorizado para resolver reclamos de padrón.';
    END IF;

    -- 2. Bloquear y obtener el reclamo
    SELECT * INTO v_claim FROM voter_registry_claims WHERE id = p_claim_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Reclamo no encontrado.';
    END IF;
    IF v_claim.status != 'PENDING' THEN
        RAISE EXCEPTION 'El reclamo ya fue resuelto anteriormente.';
    END IF;

    -- 3. Actualizar el reclamo
    UPDATE voter_registry_claims
    SET status = p_new_status,
        reviewed_by = p_reviewer_user_id,
        reviewed_at = CURRENT_TIMESTAMP,
        resolution_notes = p_resolution_notes
    WHERE id = p_claim_id;

    -- 4. Impactar cambios en el padrón electoral si el reclamo es APROBADO
    IF p_new_status = 'APPROVED' THEN
        -- Caso A: Estudiante no aparecía -> Habilitar / Insertar
        IF v_claim.claim_type = 'MISSING_FROM_REGISTRY' THEN
            INSERT INTO voter_registries (user_id, program_id, period_id, semester, is_eligible, eligibility_reason)
            SELECT 
                v_claim.user_id, 
                u.program_id, 
                v_claim.period_id, 
                COALESCE(u.current_cycle, 1), 
                TRUE, 
                'CLAIM_APPROVED_MANUAL'
            FROM users u
            WHERE u.id = v_claim.user_id
            ON CONFLICT (user_id, period_id) 
            DO UPDATE SET 
                is_eligible = TRUE, 
                eligibility_reason = 'CLAIM_APPROVED_MANUAL',
                updated_at = CURRENT_TIMESTAMP;

        -- Caso B: Reporte de usuario no elegible -> Inhabilitar en padrón
        ELSIF v_claim.claim_type = 'INELIGIBLE_MARKED_ELIGIBLE' THEN
            UPDATE voter_registries
            SET is_eligible = FALSE,
                eligibility_reason = 'CLAIM_APPROVED_INELIGIBLE',
                updated_at = CURRENT_TIMESTAMP
            WHERE user_id = v_claim.user_id AND period_id = v_claim.period_id;
        END IF;
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION resolve_voter_registry_claim(UUID, UUID, voter_claim_status, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION resolve_voter_registry_claim(UUID, UUID, voter_claim_status, TEXT) TO app_user;

COMMIT;