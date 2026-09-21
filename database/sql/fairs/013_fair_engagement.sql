-- fairs/013_fair_engagement.sql
-- Módulo de EXPLORACIÓN del JURADO: "Me gusta" + comentarios + retroalimentación.
-- COMPLETAMENTE SEPARADO de la rúbrica (fair_evaluations) y de la votación
-- oficial (fair_votes). NO participa en ranking ni en cálculo del ganador.
--
-- Tres conceptos NUNCA mezclados:
--   1. RATING/EXPLORACIÓN (este módulo) — informativo y motivacional.
--   2. RÚBRICA (fair_evaluations) — evaluación académica con checklist.
--   3. VOTACIÓN (fair_votes) — decisión oficial del jurado.
--
-- Reglas:
--   * Solo jurados FORMALMENTE ASIGNADOS a la feria pueden dar Me gusta
--     o comentar (FK compuesta → fair_jury_assignments).
--   * Solo se permite en ferias OPEN y proyectos APPROVED.
--   * UN jurado puede dar Me gusta UNA vez por proyecto (UNIQUE).
--   * Comentarios siempre anónimos para estudiantes; el backend controla
--     la visibilidad del jurado emisor (is_anonymous).
--   * Hitos de Me gusta (5, 10, 25, 50, 100) notifican al expositor UNA vez
--     por proyecto por umbral (dedupe vía fair_project_like_milestones).

BEGIN;

-- =====================================================================
-- FAIR_PROJECT_LIKES
-- =====================================================================
CREATE TABLE IF NOT EXISTS fair_project_likes (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fair_id       UUID NOT NULL,
    project_id    UUID NOT NULL,
    jury_user_id  UUID NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- 1 like por jurado y proyecto (idempotencia).
    CONSTRAINT uq_fair_project_likes_project_jury UNIQUE (project_id, jury_user_id),

    CONSTRAINT fk_fair_project_likes_fair
        FOREIGN KEY (fair_id) REFERENCES fairs(id) ON DELETE RESTRICT,
    -- FK compuesta: el proyecto pertenece a la feria (mismo orden que
    -- uq_projects_id_fair: id, fair_id).
    CONSTRAINT fk_fair_project_likes_fair_project
        FOREIGN KEY (project_id, fair_id)
        REFERENCES projects(id, fair_id) ON DELETE RESTRICT,
    -- FK compuesta: el jurado está formalmente asignado a la feria.
    CONSTRAINT fk_fair_project_likes_fair_jury
        FOREIGN KEY (fair_id, jury_user_id)
        REFERENCES fair_jury_assignments(fair_id, user_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_fair_project_likes_fair
    ON fair_project_likes (fair_id);
CREATE INDEX IF NOT EXISTS idx_fair_project_likes_project
    ON fair_project_likes (project_id);
CREATE INDEX IF NOT EXISTS idx_fair_project_likes_jury
    ON fair_project_likes (jury_user_id);

-- =====================================================================
-- FAIR_PROJECT_COMMENTS
-- =====================================================================
CREATE TABLE IF NOT EXISTS fair_project_comments (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fair_id       UUID NOT NULL,
    project_id    UUID NOT NULL,
    jury_user_id  UUID NOT NULL,
    comment       TEXT NOT NULL,
    is_anonymous  BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_fair_project_comments_fair
        FOREIGN KEY (fair_id) REFERENCES fairs(id) ON DELETE RESTRICT,
    CONSTRAINT fk_fair_project_comments_fair_project
        FOREIGN KEY (project_id, fair_id)
        REFERENCES projects(id, fair_id) ON DELETE RESTRICT,
    CONSTRAINT fk_fair_project_comments_fair_jury
        FOREIGN KEY (fair_id, jury_user_id)
        REFERENCES fair_jury_assignments(fair_id, user_id) ON DELETE RESTRICT,
    CONSTRAINT chk_fair_project_comments_not_empty
        CHECK (length(trim(comment)) > 0),
    CONSTRAINT chk_fair_project_comments_max_length
        CHECK (length(comment) <= 1000)
);

CREATE INDEX IF NOT EXISTS idx_fair_project_comments_fair
    ON fair_project_comments (fair_id);
CREATE INDEX IF NOT EXISTS idx_fair_project_comments_project
    ON fair_project_comments (project_id);
CREATE INDEX IF NOT EXISTS idx_fair_project_comments_jury
    ON fair_project_comments (jury_user_id);

-- =====================================================================
-- FAIR_PROJECT_LIKE_MILESTONES (dedupe de notificaciones)
-- =====================================================================
-- Rastrea qué umbrales ya fueron notificados por proyecto. Así nunca se
-- duplican notificaciones: si el proyecto pasa de 10 a 11 likes, el
-- servicio busca en esta tabla si el milestone=10 ya está marcado.
CREATE TABLE IF NOT EXISTS fair_project_like_milestones (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id   UUID NOT NULL,
    milestone    INTEGER NOT NULL,
    notified_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- 1 fila por (proyecto, umbral).
    CONSTRAINT uq_fair_project_like_milestones_project_milestone
        UNIQUE (project_id, milestone),

    CONSTRAINT fk_fair_project_like_milestones_project
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    CONSTRAINT chk_fair_project_like_milestones_positive
        CHECK (milestone > 0)
);

CREATE INDEX IF NOT EXISTS idx_fair_project_like_milestones_project
    ON fair_project_like_milestones (project_id);

-- =====================================================================
-- TRIGGERS: updated_at + reglas de estado
-- =====================================================================

DROP TRIGGER IF EXISTS trg_fair_project_comments_updated_at
    ON fair_project_comments;
CREATE TRIGGER trg_fair_project_comments_updated_at
BEFORE UPDATE ON fair_project_comments
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Estado: likes solo en feria OPEN y proyecto APPROVED.
CREATE OR REPLACE FUNCTION enforce_fair_engagement_state()
RETURNS TRIGGER AS $$
DECLARE
    v_fair_status  fairs.status%TYPE;
    v_proj_status  projects.status%TYPE;
    v_jury_role    users.role%TYPE;
    v_jury_status  users.status%TYPE;
BEGIN
    SELECT status INTO v_fair_status FROM fairs WHERE id = NEW.fair_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'La feria no existe';
    END IF;
    IF v_fair_status <> 'OPEN' THEN
        RAISE EXCEPTION 'El engagement solo se permite mientras la feria está abierta (OPEN)';
    END IF;

    SELECT status INTO v_proj_status FROM projects WHERE id = NEW.project_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'El proyecto no existe';
    END IF;
    IF v_proj_status <> 'APPROVED' THEN
        RAISE EXCEPTION 'Solo se puede interactuar con proyectos aprobados (APPROVED)';
    END IF;

    SELECT role, status INTO v_jury_role, v_jury_status FROM users WHERE id = NEW.jury_user_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'El jurado no existe';
    END IF;
    IF v_jury_role <> 'JURY' THEN
        RAISE EXCEPTION 'Solo usuarios con rol JURY pueden dar Me gusta o comentar';
    END IF;
    IF v_jury_status <> 'ACTIVE' THEN
        RAISE EXCEPTION 'El jurado no está activo';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_fair_project_likes_state ON fair_project_likes;
CREATE TRIGGER trg_fair_project_likes_state
BEFORE INSERT ON fair_project_likes
FOR EACH ROW EXECUTE FUNCTION enforce_fair_engagement_state();

DROP TRIGGER IF EXISTS trg_fair_project_comments_state ON fair_project_comments;
CREATE TRIGGER trg_fair_project_comments_state
BEFORE INSERT OR UPDATE ON fair_project_comments
FOR EACH ROW EXECUTE FUNCTION enforce_fair_engagement_state();

COMMIT;
