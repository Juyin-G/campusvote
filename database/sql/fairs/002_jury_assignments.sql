-- fairs/002_jury_assignments.sql
-- Asignación formal de JURADOS (usuarios con rol global JURY) a una FERIA.
--
-- Dominio exclusivo de FERIAS: NO se mezcla con jury_assignments del dominio
-- electoral (elections/candidacies, doble ciego, estado PENDING/APPROVED/
-- REJECTED y dirimencia).
--
-- Estructura:
--   Organization ── Fair ── FairJuryAssignment ── User (role = JURY)
--
-- Decisiones:
--   * Sin columna "status": la asignación es la formalidad en sí misma
--     (no hay flujo de aprobación como en el dominio electoral); "quitar
--     jurado" elimina la fila. No se inventan estados.
--   * UNIQUE (fair_id, user_id): un JURY no puede asignarse dos veces a la
--     misma feria.
--   * Tenant: la pertenencia a la organización se valida en el servicio
--     (fair.organization_id === user.organization_id), siguiendo el patrón de
--     assertTenantAccess de rating/objection/fair. No se agrega una columna
--     espejo organization_id porque el dominio de jurados no tiene historial
--     de datos (a diferencia de projects en el Paso 3).

BEGIN;

CREATE TABLE IF NOT EXISTS fair_jury_assignments (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fair_id     UUID NOT NULL REFERENCES fairs(id) ON DELETE RESTRICT,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    assigned_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Un JURY no puede asignarse dos veces a la misma feria.
    CONSTRAINT uq_fair_jury_assignments_fair_user UNIQUE (fair_id, user_id)
);

-- ÍNDICES: la UNIQUE (fair_id, user_id) ya cubre consultas por feria;
-- se indexa user_id para "mis ferias asignadas" (JURY) y borrados por jurado.

CREATE INDEX IF NOT EXISTS idx_fair_jury_assignments_user
    ON fair_jury_assignments (user_id);

-- TRIGGER: ACTUALIZAR updated_at

DROP TRIGGER IF EXISTS trg_fair_jury_assignments_updated_at ON fair_jury_assignments;
CREATE TRIGGER trg_fair_jury_assignments_updated_at
BEFORE UPDATE ON fair_jury_assignments
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;