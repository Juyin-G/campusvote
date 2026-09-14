-- fairs/009_fair_jury_declarations.sql
-- Declaración de imparcialidad firmada por un JURY asignado a una FERIA.
--
-- Estructura:
--   FairJuryAssignment (fair + jury) ── FairJuryDeclaration (statement, signed_at)
--
-- Decisiones:
--   * UNIQUE (fair_id, jury_user_id): UNA declaración por (feria, jurado).
--   * La declaración EXIGE la asignación formal del jurado (trigger + service).
--   * La evaluación de un proyecto exige la declaración previa (service, y el
--     004_fair_evaluations.sql valida que el jurado esté asignado).
--   * ON DELETE CASCADE en ambos extremos: la declaración deja de existir si la
--     feria o el usuario desaparecen (sin historial persistente).
--   * signed_at = momento de la firma (se usa como fecha de la declaración).

BEGIN;

CREATE TABLE IF NOT EXISTS fair_jury_declarations (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fair_id      UUID NOT NULL REFERENCES fairs(id) ON DELETE CASCADE,
    jury_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    statement    TEXT NOT NULL,
    signed_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_fair_jury_declarations_fair_jury UNIQUE (fair_id, jury_user_id),
    CONSTRAINT chk_fair_jury_declarations_statement_not_empty CHECK (length(trim(statement)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_fair_jury_declarations_jury
    ON fair_jury_declarations (jury_user_id);

-- TRIGGER: actualizar updated_at
DROP TRIGGER IF EXISTS trg_fair_jury_declarations_updated_at ON fair_jury_declarations;
CREATE TRIGGER trg_fair_jury_declarations_updated_at
BEFORE UPDATE ON fair_jury_declarations
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;