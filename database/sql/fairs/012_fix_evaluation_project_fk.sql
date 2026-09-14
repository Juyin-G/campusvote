-- fairs/012_fix_evaluation_project_fk.sql
-- Corrige la FK compuesta de fair_evaluations hacia projects.
--
-- 004_fair_evaluations.sql la declaró con las columnas cruzadas:
--   FOREIGN KEY (fair_id, project_id) REFERENCES projects(id, fair_id)
-- es decir, comparaba el fair_id de la evaluación con el id del proyecto.
-- Ninguna evaluación real podía guardarse (el jurado recibía un error de FK).
--
-- La intención documentada en 004 es "el proyecto pertenece a la MISMA feria
-- que la evaluación": (project_id, fair_id) -> projects(id, fair_id).
-- Idempotente: se elimina y se vuelve a crear con el orden correcto.

BEGIN;

ALTER TABLE fair_evaluations
    DROP CONSTRAINT IF EXISTS fk_fair_evaluations_fair_project;

ALTER TABLE fair_evaluations
    ADD CONSTRAINT fk_fair_evaluations_fair_project
    FOREIGN KEY (project_id, fair_id) REFERENCES projects(id, fair_id)
    ON DELETE RESTRICT;

COMMIT;
