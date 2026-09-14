-- fairs/005_fair_result_publications.sql
-- Publicación oficial de resultados de ferias (dominio exclusivo de FERIAS).
-- Persistencia MÍNIMA del evento "resultados publicados":
--
--   * Máximo UNA publicación por feria: UNIQUE (fair_id).
--   * published_by -> users(id): quién publicó (pista de auditoría).
--   * created_at / updated_at: CUÁNDO se publicó (se usa como published_at).
--   * NO se persiste ranking/ganador/promedio: eso se DERIVA en el service a
--     partir de fair_evaluations (fairResult.service.js). El estado "publicado"
--     se deduce de la EXISTENCIA de esta fila.
--   * Trigger: solo se publican resultados de ferias CLOSED (integridad, espejo
--     del chequeo en service).

BEGIN;

CREATE TABLE IF NOT EXISTS fair_result_publications (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fair_id       UUID NOT NULL,
    published_by  UUID NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_fair_result_publications_fair UNIQUE (fair_id),
    CONSTRAINT fk_fair_result_publications_fair FOREIGN KEY (fair_id)      REFERENCES fairs(id) ON DELETE RESTRICT,
    CONSTRAINT fk_fair_result_publications_user FOREIGN KEY (published_by) REFERENCES users(id) ON DELETE RESTRICT
);

-- TRIGGER: solo se publican resultados de una feria CLOSED.
CREATE OR REPLACE FUNCTION enforce_fair_result_publication_rules()
RETURNS TRIGGER AS $$
DECLARE
    v_status fairs.status%TYPE;
BEGIN
    SELECT status INTO v_status FROM fairs WHERE id = NEW.fair_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'La feria no existe';
    END IF;
    IF v_status <> 'CLOSED' THEN
        RAISE EXCEPTION 'Solo se pueden publicar los resultados de una feria cerrada (CLOSED)';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_fair_result_publications_rules ON fair_result_publications;
CREATE TRIGGER trg_fair_result_publications_rules
BEFORE INSERT OR UPDATE ON fair_result_publications
FOR EACH ROW EXECUTE FUNCTION enforce_fair_result_publication_rules();

-- TRIGGERS: updated_at
DROP TRIGGER IF EXISTS trg_fair_result_publications_updated_at ON fair_result_publications;
CREATE TRIGGER trg_fair_result_publications_updated_at
BEFORE UPDATE ON fair_result_publications
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;