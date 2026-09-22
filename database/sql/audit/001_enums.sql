--src/database/sql/audit/001_enums.sql

BEGIN;

-- ENUM: TIPOS DE ACCIONES DE AUDITORÍA
-- El dominio de elecciones fue removido (FASE 13). Solo sobreviven acciones
-- de CORE (login/2FA/acceso denegado) y del dominio de FERIAS.

DO $$
BEGIN
    CREATE TYPE audit_action_type AS ENUM (
        'LOGIN',
        'VERIFY_2FA',
        'ACCESS_DENIED',
        'CAST_FAIR_VOTE',
        'FAIR_VOTE_ATTEMPT_DENIED',
        'RUBRIC_CHECKLIST_FINALIZED',
        'PROJECT_LIKED',
        'PROJECT_COMMENTED'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

COMMIT;