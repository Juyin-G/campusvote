-- Fix #3: Resolver doble FK contradictoria en organization_requests.reviewed_by
-- Problema: 999_foreign_keys.sql creó 'fk_org_requests_reviewed_by' (SET NULL) 
-- que entra en conflicto con la FK inline de 003 (RESTRICT).
-- Solución: Eliminar la FK redundante de 999 y mantener la original con RESTRICT.

BEGIN;

-- 1. Verificar si existe la FK conflictiva de 999_foreign_keys.sql y eliminarla
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'fk_org_requests_reviewed_by' 
        AND conrelid = 'organization_requests'::regclass
    ) THEN
        ALTER TABLE organization_requests DROP CONSTRAINT fk_org_requests_reviewed_by;
        RAISE NOTICE ' Eliminada FK conflictiva: fk_org_requests_reviewed_by (SET NULL)';
    ELSE
        RAISE NOTICE ' La FK conflictiva fk_org_requests_reviewed_by no existe (ya fue corregida o nunca se creó)';
    END IF;
END $$;

-- 2. Verificar que la FK correcta (RESTRICT) siga existiendo
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'organization_requests_reviewed_by_fkey' 
        AND conrelid = 'organization_requests'::regclass
    ) THEN
        RAISE EXCEPTION 'ERROR CRÍTICO: La FK original organization_requests_reviewed_by_fkey (RESTRICT) NO existe. ¡Revisar integridad referencial!';
    ELSE
        RAISE NOTICE 'FK correcta verificada: organization_requests_reviewed_by_fkey (ON DELETE RESTRICT)';
    END IF;
END $$;

COMMIT;