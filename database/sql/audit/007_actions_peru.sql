-- audit/007_actions_peru.sql
-- Nuevas acciones de auditoría para el plan peruano (tachas, jurados, rúbricas).

BEGIN;

DO $$ BEGIN
    ALTER TYPE audit_action_type ADD VALUE IF NOT EXISTS 'FILE_OBJECTION';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TYPE audit_action_type ADD VALUE IF NOT EXISTS 'RESOLVE_OBJECTION';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TYPE audit_action_type ADD VALUE IF NOT EXISTS 'ASSIGN_JURY';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TYPE audit_action_type ADD VALUE IF NOT EXISTS 'SUBMIT_RATING';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TYPE audit_action_type ADD VALUE IF NOT EXISTS 'REVOKE_RATING';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TYPE audit_action_type ADD VALUE IF NOT EXISTS 'RESTORE_RATING';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TYPE audit_action_type ADD VALUE IF NOT EXISTS 'ACCESS_DENIED';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMIT;