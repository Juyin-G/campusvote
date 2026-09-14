-- user/012_drop_observer_role.sql
-- Retira el rol OBSERVER en bases existentes.
--
-- Instalaciones nuevas: 001_enums.sql ya crea user_role sin OBSERVER y este
-- script no hace nada.
--
-- Bases existentes (creadas cuando user_role incluía OBSERVER): recrear el
-- tipo sin el valor NO es viable. Convertir users.role a TEXT obliga a
-- reconstruir cada CHECK, índice y vista que compara role contra literales
-- 'X'::user_role (chk_users_academic_linkage, chk_users_student_data, ...), y
-- el ALTER falla con "operator does not exist: text = user_role".
--
-- En su lugar el valor queda inerte en el tipo y se prohíbe usarlo:
--   * si hay usuarios con OBSERVER, se aborta (reasignarlos es una decisión de
--     datos que se toma a mano);
--   * chk_users_role_not_observer impide que vuelva a asignarse.
-- La aplicación (roles.js, validaciones Zod) ya no conoce OBSERVER.
-- Idempotente.

BEGIN;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_enum e
        JOIN pg_type t ON t.oid = e.enumtypid
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'user_role'
          AND n.nspname = 'public'
          AND e.enumlabel = 'OBSERVER'
    ) THEN
        RAISE NOTICE 'user_role no contiene OBSERVER; no se requiere migración.';
        RETURN;
    END IF;

    IF EXISTS (SELECT 1 FROM users WHERE role::text = 'OBSERVER') THEN
        RAISE EXCEPTION 'Existen usuarios con rol OBSERVER. Reasigna manualmente su rol antes de continuar.';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_users_role_not_observer'
    ) THEN
        ALTER TABLE users
            ADD CONSTRAINT chk_users_role_not_observer CHECK (role::text <> 'OBSERVER');
    END IF;

    RAISE NOTICE 'Rol OBSERVER retirado: queda inerte en el tipo y prohibido en users.';
END $$;

COMMIT;
