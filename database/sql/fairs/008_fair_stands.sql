-- fairs/008_fair_stands.sql
-- Cabinas/stands de UNA feria (dominio exclusivo de FERIAS).
-- Estructura:
--   Fair ── FairStand (fair_id, code) ── Project (projects.stand_id)
--
-- Decisiones:
--   * UNIQUE (fair_id, code): el identificador corto del stand (p. ej. "A-01")
--     es único dentro de la feria.
--   * "1 stand = 1 proyecto": projects.stand_id es UNIQUE (nullable; un stand
--     no puede estar asignado a dos proyectos). Refuerza projects/003.
--   * Par clave (id, fair_id): destino de la FK compuesta desde projects
--     (projects/003) que asegura "el stand pertenece a la MISMA feria que el
--     proyecto".
--   * Los proyectos referencian stands con ON DELETE RESTRICT: el backend
--     devuelve 409 (no el FK) cuando hay proyectos usando el stand.

BEGIN;

CREATE TABLE IF NOT EXISTS fair_stands (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fair_id     UUID NOT NULL REFERENCES fairs(id) ON DELETE CASCADE,
    code        VARCHAR(100) NOT NULL,
    description TEXT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_fair_stands_fair_code UNIQUE (fair_id, code),
    CONSTRAINT chk_fair_stands_code_not_empty CHECK (length(trim(code)) > 0)
);

-- Par clave (id, fair_id) para la FK compuesta desde projects.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_fair_stands_id_fair') THEN
        ALTER TABLE fair_stands ADD CONSTRAINT uq_fair_stands_id_fair UNIQUE (id, fair_id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_fair_stands_fair
    ON fair_stands (fair_id);

-- TRIGGER: ACTUALIZAR updated_at
DROP TRIGGER IF EXISTS trg_fair_stands_updated_at ON fair_stands;
CREATE TRIGGER trg_fair_stands_updated_at
BEFORE UPDATE ON fair_stands
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;