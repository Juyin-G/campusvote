-- fairs/015_fair_project_fk_repair.sql
-- REPARACIÓN de integridad referencial.
--
-- Las FK compuestas "proyecto ↔ feria" se declararon con las columnas
-- invertidas:
--
--     FOREIGN KEY (fair_id, project_id) REFERENCES projects(id, fair_id)
--
-- Esto empareja fair_id -> projects.id y project_id -> projects.fair_id, lo
-- que hace IMPOSIBLE insertar cualquier fila (fair_votes, fair_evaluations,
-- fair_project_likes, fair_project_comments): el proyecto nunca tiene
-- fair_id = id. El orden correcto, coherente con uq_projects_id_fair
-- (id, fair_id), es:
--
--     FOREIGN KEY (project_id, fair_id) REFERENCES projects(id, fair_id)
--
-- En bases de datos nuevas basta con la definición corregida en 004/012b/013;
-- esta migración corrige las bases que YA tienen las tablas creadas (los
-- CREATE TABLE IF NOT EXISTS no reescriben constraints existentes).

BEGIN;

-- fair_evaluations
ALTER TABLE fair_evaluations
    DROP CONSTRAINT IF EXISTS fk_fair_evaluations_fair_project;
ALTER TABLE fair_evaluations
    ADD CONSTRAINT fk_fair_evaluations_fair_project
    FOREIGN KEY (project_id, fair_id)
    REFERENCES projects(id, fair_id) ON DELETE RESTRICT;

-- fair_votes
ALTER TABLE fair_votes
    DROP CONSTRAINT IF EXISTS fk_fair_votes_fair_project;
ALTER TABLE fair_votes
    ADD CONSTRAINT fk_fair_votes_fair_project
    FOREIGN KEY (project_id, fair_id)
    REFERENCES projects(id, fair_id) ON DELETE RESTRICT;

-- fair_project_likes
ALTER TABLE fair_project_likes
    DROP CONSTRAINT IF EXISTS fk_fair_project_likes_fair_project;
ALTER TABLE fair_project_likes
    ADD CONSTRAINT fk_fair_project_likes_fair_project
    FOREIGN KEY (project_id, fair_id)
    REFERENCES projects(id, fair_id) ON DELETE RESTRICT;

-- fair_project_comments
ALTER TABLE fair_project_comments
    DROP CONSTRAINT IF EXISTS fk_fair_project_comments_fair_project;
ALTER TABLE fair_project_comments
    ADD CONSTRAINT fk_fair_project_comments_fair_project
    FOREIGN KEY (project_id, fair_id)
    REFERENCES projects(id, fair_id) ON DELETE RESTRICT;

COMMIT;