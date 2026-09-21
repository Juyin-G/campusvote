-- fairs/014_fair_status_transition.sql
-- Parte 3 — Estados de la feria: máquina de estados en PostgreSQL.
--
-- Hasta ahora la transición de estado de una feria solo estaba protegida en
-- Node (fair.service.js); no existía equivalente SQL (a diferencia de
-- elections, que sí tiene validate_election_status_transition).
--
-- Reglas reforzadas aquí (espejo de Node):
--   * Transiciones permitidas: DRAFT -> OPEN, OPEN -> DRAFT, OPEN -> CLOSED.
--     CLOSED es terminal.
--   * OPEN -> DRAFT se bloquea si YA EXISTE participación:
--       1. alguna fila en fair_vote_participation, O
--       2. alguna fair_evaluations con submitted_at IS NOT NULL.
--
-- Los votos y rúbricas existentes NO se modifican ni invalidan: este trigger
-- solo impide el cambio de estado, nunca toca la participación.

BEGIN;

CREATE OR REPLACE FUNCTION validate_fair_status_transition()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_has_votes     BOOLEAN;
    v_has_finalized BOOLEAN;
BEGIN
    -- Solo evaluamos cuando el estado realmente cambia.
    IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
        RETURN NEW;
    END IF;

    -- 1) Máquina de estados estricta.
    IF NOT (
        (OLD.status = 'DRAFT' AND NEW.status = 'OPEN') OR
        (OLD.status = 'OPEN'  AND NEW.status = 'DRAFT') OR
        (OLD.status = 'OPEN'  AND NEW.status = 'CLOSED')
    ) THEN
        RAISE EXCEPTION 'Transición de estado de feria inválida: % -> %', OLD.status, NEW.status;
    END IF;

    -- 2) OPEN -> DRAFT solo si NO existe participación.
    IF OLD.status = 'OPEN' AND NEW.status = 'DRAFT' THEN
        SELECT EXISTS(
            SELECT 1 FROM fair_vote_participation WHERE fair_id = NEW.id
        ) INTO v_has_votes;

        SELECT EXISTS(
            SELECT 1 FROM fair_evaluations
            WHERE fair_id = NEW.id AND submitted_at IS NOT NULL
        ) INTO v_has_finalized;

        IF v_has_votes OR v_has_finalized THEN
            RAISE EXCEPTION
                'La feria ya tiene participación (votos o rúbricas finalizadas); no puede volver a preparación (DRAFT)';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fairs_status_transition ON fairs;
CREATE TRIGGER trg_fairs_status_transition
BEFORE UPDATE ON fairs
FOR EACH ROW EXECUTE FUNCTION validate_fair_status_transition();

COMMIT;