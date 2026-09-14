-- fairs/011_fair_registration_deadline.sql
-- Cierre de INSCRIPCIÓN de proyectos de una feria.
--
-- Pasada esta fecha nadie inscribe, edita, envía ni cambia integrantes de un
-- proyecto: el jurado evalúa la versión final. Si la columna queda en NULL,
-- el servicio usa por defecto 24 horas antes de starts_at (y, si la feria
-- tampoco tiene starts_at, la inscripción no tiene límite de fecha).
--
-- El CHECK impide configurar un cierre posterior al inicio de la feria.

BEGIN;

ALTER TABLE fairs ADD COLUMN IF NOT EXISTS registration_deadline TIMESTAMPTZ NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_fairs_registration_before_start'
    ) THEN
        ALTER TABLE fairs
            ADD CONSTRAINT chk_fairs_registration_before_start
            CHECK (
                registration_deadline IS NULL
                OR starts_at IS NULL
                OR registration_deadline <= starts_at
            );
    END IF;
END $$;

COMMIT;
