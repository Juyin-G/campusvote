-- fairs/016_fair_jury_category_assignments.sql
-- Asignación de JURADOS a CATEGORÍAS dentro de una FERIA (N:M).
--
-- Estructura:
--   FairJuryAssignment (fair + jury)
--       └── FairJuryCategoryAssignment (jury_assignment + category)
--               └── FairCategory (fair + category)
--
-- Decisiones:
--   * N:M: un JURY puede estar en múltiples categorías de la misma feria.
--   * UNIQUE (jury_assignment_id, category_id): sin duplicados.
--   * FK compuesta: la categoría SIEMPRE pertenece a la misma feria que la
--     asignación del jurado (reforzado con trigger).
--   * ON DELETE CASCADE en jury_assignment: al desasignar un jurado de la
--     feria, se eliminan sus asignaciones de categoría.
--   * ON DELETE RESTRICT en category: no se puede eliminar una categoría que
--     tiene jurados asignados.
--   * Las asignaciones solo se modifican en DRAFT (service); en OPEN quedan
--     congeladas.

BEGIN;

CREATE TABLE IF NOT EXISTS fair_jury_category_assignments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    jury_assignment_id  UUID NOT NULL REFERENCES fair_jury_assignments(id) ON DELETE CASCADE,
    category_id         UUID NOT NULL REFERENCES fair_categories(id) ON DELETE RESTRICT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Un jurado no puede estar asignado dos veces a la misma categoría.
    CONSTRAINT uq_fair_jury_category_assignments UNIQUE (jury_assignment_id, category_id)
);

-- Índices para consultas frecuentes.
CREATE INDEX IF NOT EXISTS idx_fair_jury_category_assignments_jury
    ON fair_jury_category_assignments (jury_assignment_id);
CREATE INDEX IF NOT EXISTS idx_fair_jury_category_assignments_category
    ON fair_jury_category_assignments (category_id);

-- TRIGGER: actualizar updated_at
DROP TRIGGER IF EXISTS trg_fair_jury_category_assignments_updated_at ON fair_jury_category_assignments;
CREATE TRIGGER trg_fair_jury_category_assignments_updated_at
BEFORE UPDATE ON fair_jury_category_assignments
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;
