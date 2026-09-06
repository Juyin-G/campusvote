-- 012_activation_enum.sql
-- Onboarding de administradores: agrega el estado intermedio PENDING_ACTIVATION
-- al enum user_status. Vive en su propia transacción porque Postgres no permite
-- usar un valor recién agregado al enum dentro de la misma transacción que lo
-- agrega (el 013_activation.sql ya lo referencia en su CHECK de contraseña).

BEGIN;

DO $$
BEGIN
    ALTER TYPE user_status ADD VALUE IF NOT EXISTS 'PENDING_ACTIVATION';
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

COMMIT;