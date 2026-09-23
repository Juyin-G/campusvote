-- Fix #1: Agregar valor faltante al enum de auditoría
-- Problema: Prisma espera 'PROJECT_LIKE_MILESTONE' pero la BD no lo tiene.
-- Solución: Añadir el valor de forma idempotente (seguro de ejecutar múltiples veces).

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'PROJECT_LIKE_MILESTONE' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'audit_action_type')
    ) THEN
        ALTER TYPE audit_action_type ADD VALUE 'PROJECT_LIKE_MILESTONE';
        RAISE NOTICE '✅ Valor PROJECT_LIKE_MILESTONE añadido a audit_action_type';
    ELSE
        RAISE NOTICE 'ℹ️ El valor PROJECT_LIKE_MILESTONE ya existe en audit_action_type';
    END IF;
END $$;