-- fairs/011_certificates.sql
-- Certificados oficiales de FERIAS (dominio exclusivo de ferias; ajeno al
-- dominio electoral).
--
-- Reglas de dominio:
--   * Se emiten SOLO después de la publicación oficial de los resultados
--     (fair_result_publications existe) y con fair.status = CLOSED. La
--     generación valida esto en service; este SQL aporta las restricciones
--     mínimas de unicidad, FK e inmutabilidad.
--   * certificate_type: PARTICIPATION (todos los miembros de un proyecto
--     APPROVED) y WINNER (únicamente los miembros del proyecto con
--     position === 1 según el ranking derivado por fairResult.service).
--   * El GANADOR NO se persiste como estado: la fuente de verdad es siempre
--     getFairResults(). Aquí solo se guarda la pertenencia al certificado.
--   * UNIQUE (fair_id, project_id, user_id, certificate_type) garantiza que
--     no se generen duplicados para el mismo participante/tipo.
--   * El DNI NO forma parte del identificador: la PK es el id (UUID).
--
-- Decisiones:
--   * ON DELETE RESTRICT: el certificado no se borra en cascada (los
--     certificados emitidos son inmutables y trazables).
--   * created_at == issue_date (fecha de emisión). No se almacena
--     created_at por separado para no duplicar el mismo dato; issue_date
--     ya es el momento de creación del certificado.
--   * description y valid_until son opcionales (texto libre para el ADMIN;
--     fecha de validez si se quiere añadir más adelante).

BEGIN;

DO $$ BEGIN
    CREATE TYPE certificate_type AS ENUM ('PARTICIPATION', 'WINNER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS certificates (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fair_id           UUID NOT NULL,
    project_id        UUID NOT NULL,
    user_id           UUID NOT NULL,
    certificate_type  certificate_type NOT NULL,
    issue_date        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    description       TEXT NULL,
    valid_until       TIMESTAMPTZ NULL,

    CONSTRAINT fk_certificates_fair    FOREIGN KEY (fair_id)    REFERENCES fairs(id)    ON DELETE RESTRICT,
    CONSTRAINT fk_certificates_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE RESTRICT,
    CONSTRAINT fk_certificates_user    FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE RESTRICT,
    -- Un mismo participante no puede tener dos certificados del mismo tipo
    -- para el mismo (proyecto, feria). Esta restricción evita duplicados a
    -- nivel de BD; el service es idempotente y NO depende exclusivamente
    -- de esta restricción (hace upsert + race-condition guard).
    CONSTRAINT uq_certificates_fair_project_user_type
        UNIQUE (fair_id, project_id, user_id, certificate_type)
);

CREATE INDEX IF NOT EXISTS idx_certificates_user
    ON certificates (user_id);
CREATE INDEX IF NOT EXISTS idx_certificates_fair_project_user_type
    ON certificates (fair_id, project_id, user_id, certificate_type);
CREATE INDEX IF NOT EXISTS idx_certificates_fair_user
    ON certificates (fair_id, user_id);

COMMIT;