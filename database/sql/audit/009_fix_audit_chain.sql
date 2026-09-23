-- Fix #2: Corregir el cálculo del hash en la verificación de la cadena de auditoría
-- Problema: verify_audit_chain() usaba r.timestamp::text, que no coincide con 
-- el formato 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"' usado en compute_audit_log_hash().
-- Solución: CREATE OR REPLACE FUNCTION para alinear el formato de fecha.

BEGIN;

CREATE OR REPLACE FUNCTION verify_audit_chain()
RETURNS TABLE (
    total_records BIGINT,
    is_valid BOOLEAN,
    first_broken_id UUID,
    first_broken_sequence BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    r RECORD;
    v_prev_hash VARCHAR(64) := '';
    v_computed_hash VARCHAR(64);
    v_count BIGINT := 0;
    v_formatted_ts TEXT;
BEGIN
    FOR r IN SELECT * FROM audit_logs ORDER BY sequence_num ASC LOOP
        v_count := v_count + 1;
        
        -- 1. Validar que el previous_hash coincida con el current_hash del registro anterior
        IF r.previous_hash != v_prev_hash THEN
            RETURN QUERY SELECT v_count, FALSE, r.id, r.sequence_num;
            RETURN;
        END IF;

        -- 2. CORRECCIÓN: Usar el MISMO formato de fecha que compute_audit_log_hash()
        v_formatted_ts := to_char(r.timestamp AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"');

        -- 3. Recalcular el hash con el formato correcto
        v_computed_hash := encode(
            digest(
                r.previous_hash || 
                r.action::text || 
                v_formatted_ts || 
                COALESCE(r.actor_id::text, '') || 
                r.metadata::text,
                'sha256'
            ),
            'hex'
        );

        -- 4. Validar que el current_hash guardado coincida con el recalculado
        IF r.current_hash != v_computed_hash THEN
            RETURN QUERY SELECT v_count, FALSE, r.id, r.sequence_num;
            RETURN;
        END IF;

        v_prev_hash := r.current_hash;
    END LOOP;

    -- Si el bucle termina sin retornar, la cadena es válida
    RETURN QUERY SELECT v_count, TRUE, NULL::UUID, NULL::BIGINT;
END;
$$;

COMMIT;