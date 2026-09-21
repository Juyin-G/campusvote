-- fairs/012b_fair_anonymous_voting.sql
-- Módulo NUEVO: VOTACIÓN ANÓNIMA de JURADO en FERIAS (parte 2 de 012).
-- Tablas: fair_vote_participation + fair_votes. Triggers: inmutabilidad,
-- reglas de rol/asignación/feria/proyecto.

BEGIN;

-- =====================================================================
-- PARTICIPACIÓN (fair + jury) — UNIQUE fair_id, jury_user_id
-- =====================================================================

CREATE TABLE IF NOT EXISTS fair_vote_participation (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fair_id      UUID NOT NULL,
    jury_user_id UUID NOT NULL,
    voted_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    created_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_fair_vote_participation_fair_jury
        UNIQUE (fair_id, jury_user_id),
    CONSTRAINT fk_fair_vote_participation_fair
        FOREIGN KEY (fair_id) REFERENCES fairs(id) ON DELETE RESTRICT,
    CONSTRAINT fk_fair_vote_participation_user
        FOREIGN KEY (jury_user_id) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_fair_vote_participation_jury
    ON fair_vote_participation (jury_user_id);
CREATE INDEX IF NOT EXISTS idx_fair_vote_participation_fair
    ON fair_vote_participation (fair_id);

-- =====================================================================
-- VOTOS (anónimos)
-- =====================================================================

CREATE TABLE IF NOT EXISTS fair_votes (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fair_id      UUID NOT NULL,
    project_id   UUID NOT NULL,
    receipt_code VARCHAR(64) NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_fair_votes_receipt UNIQUE (fair_id, receipt_code),
    CONSTRAINT fk_fair_votes_fair
        FOREIGN KEY (fair_id) REFERENCES fairs(id) ON DELETE RESTRICT,
    -- IMPORTANTE: las columnas deben emparejar posición a posición con
    -- uq_projects_id_fair (id, fair_id): project_id -> projects.id y
    -- fair_id -> projects.fair_id. (Antes estaba invertido.)
    CONSTRAINT fk_fair_votes_fair_project
        FOREIGN KEY (project_id, fair_id)
        REFERENCES projects(id, fair_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_fair_votes_fair ON fair_votes (fair_id);
CREATE INDEX IF NOT EXISTS idx_fair_votes_project ON fair_votes (project_id);

-- =====================================================================
-- TRIGGERS updated_at
-- =====================================================================

DROP TRIGGER IF EXISTS trg_fair_vote_participation_updated_at
    ON fair_vote_participation;
CREATE TRIGGER trg_fair_vote_participation_updated_at
BEFORE UPDATE ON fair_vote_participation
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_fair_votes_updated_at ON fair_votes;
CREATE TRIGGER trg_fair_votes_updated_at
BEFORE UPDATE ON fair_votes
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =====================================================================
-- TRIGGERS: inmutabilidad de la participación (voto definitivo)
-- =====================================================================

CREATE OR REPLACE FUNCTION enforce_fair_vote_participation_immutability()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'La participación de votación es inmutable: el voto es definitivo';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_fair_vote_participation_no_update
    ON fair_vote_participation;
CREATE TRIGGER trg_fair_vote_participation_no_update
BEFORE UPDATE ON fair_vote_participation
FOR EACH ROW EXECUTE FUNCTION enforce_fair_vote_participation_immutability();

DROP TRIGGER IF EXISTS trg_fair_vote_participation_no_delete
    ON fair_vote_participation;
CREATE TRIGGER trg_fair_vote_participation_no_delete
BEFORE DELETE ON fair_vote_participation
FOR EACH ROW EXECUTE FUNCTION enforce_fair_vote_participation_immutability();

-- =====================================================================
-- TRIGGER: rol JURY, ACTIVE, misma organización, feria OPEN, asignado
-- =====================================================================

CREATE OR REPLACE FUNCTION enforce_fair_vote_participation_rules()
RETURNS TRIGGER AS $$
DECLARE
    v_user_role    users.role%TYPE;
    v_user_status  users.status%TYPE;
    v_user_org     UUID;
    v_fair_org     UUID;
    v_fair_status  fairs.status%TYPE;
    v_assigned     BOOLEAN;
BEGIN
    SELECT status, organization_id INTO v_fair_status, v_fair_org
        FROM fairs WHERE id = NEW.fair_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'La feria no existe';
    END IF;
    IF v_fair_status <> 'OPEN' THEN
        RAISE EXCEPTION 'Solo se puede votar mientras la feria está abierta (OPEN)';
    END IF;

    SELECT role, status, organization_id INTO v_user_role, v_user_status, v_user_org
        FROM users WHERE id = NEW.jury_user_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'El jurado no existe';
    END IF;
    IF v_user_role <> 'JURY' THEN
        RAISE EXCEPTION 'Solo los usuarios con rol JURY pueden votar';
    END IF;
    IF v_user_status <> 'ACTIVE' THEN
        RAISE EXCEPTION 'El jurado no está activo';
    END IF;
    IF v_user_org IS DISTINCT FROM v_fair_org THEN
        RAISE EXCEPTION 'El jurado no pertenece a la misma organización que la feria';
    END IF;

    SELECT EXISTS(
        SELECT 1 FROM fair_jury_assignments
        WHERE fair_id = NEW.fair_id AND user_id = NEW.jury_user_id
    ) INTO v_assigned;
    IF NOT v_assigned THEN
        RAISE EXCEPTION 'El jurado no está asignado a esta feria';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_fair_vote_participation_rules
    ON fair_vote_participation;
CREATE TRIGGER trg_fair_vote_participation_rules
BEFORE INSERT ON fair_vote_participation
FOR EACH ROW EXECUTE FUNCTION enforce_fair_vote_participation_rules();

-- =====================================================================
-- TRIGGER: voto a proyecto APPROVED de la MISMA feria
-- =====================================================================

CREATE OR REPLACE FUNCTION enforce_fair_vote_rules()
RETURNS TRIGGER AS $$
DECLARE
    v_project_status projects.status%TYPE;
    v_project_fair   projects.fair_id%TYPE;
BEGIN
    SELECT status, fair_id INTO v_project_status, v_project_fair
        FROM projects WHERE id = NEW.project_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'El proyecto no existe';
    END IF;
    IF v_project_fair <> NEW.fair_id THEN
        RAISE EXCEPTION 'El proyecto no pertenece a la feria del voto';
    END IF;
    IF v_project_status <> 'APPROVED' THEN
        RAISE EXCEPTION 'Solo se puede votar por proyectos aprobados (APPROVED)';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_fair_votes_rules ON fair_votes;
CREATE TRIGGER trg_fair_votes_rules
BEFORE INSERT OR UPDATE ON fair_votes
FOR EACH ROW EXECUTE FUNCTION enforce_fair_vote_rules();

COMMIT;
