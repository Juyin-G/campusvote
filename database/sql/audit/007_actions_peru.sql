-- audit/007_actions_peru.sql
-- Nuevas acciones de auditoría para el plan peruano (ferias, rúbricas, likes).
-- Post-FASE 13 (ELIMINACIÓN del dominio electores): se removieron las acciones
-- electorales (FILE_OBJECTION, RESOLVE_OBJECTION, ASSIGN_JURY, etc.) y solo se
-- añaden las del dominio FERIAS + denegaciones de acceso.

BEGIN;

DO $$ BEGIN
    ALTER TYPE audit_action_type ADD VALUE IF NOT EXISTS 'ACCESS_DENIED';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TYPE audit_action_type ADD VALUE IF NOT EXISTS 'CAST_FAIR_VOTE';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TYPE audit_action_type ADD VALUE IF NOT EXISTS 'FAIR_VOTE_ATTEMPT_DENIED';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TYPE audit_action_type ADD VALUE IF NOT EXISTS 'RUBRIC_CHECKLIST_FINALIZED';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TYPE audit_action_type ADD VALUE IF NOT EXISTS 'PROJECT_LIKED';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TYPE audit_action_type ADD VALUE IF NOT EXISTS 'PROJECT_COMMENTED';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMIT;