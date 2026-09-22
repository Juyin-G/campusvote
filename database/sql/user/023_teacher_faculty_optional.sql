-- user/023_teacher_faculty_optional.sql
-- La facultad del docente pasa a ser OPCIONAL.
--
-- Antes era user/016. user/022 reconstruye el tipo user_role y vuelve a crear
-- chk_users_academic_linkage con la regla original; por eso este script corre
-- después de 022 y con otro nombre: las bases que ya aplicaron 016 también
-- lo ejecutan.
--
-- La plataforma sirve a instituciones de distintos tipos (universidad,
-- instituto, colegio, empresa, asociación): un colegio o una empresa no tienen
-- facultades, así que exigirla impedía registrar a sus docentes.
--
-- 002_users_table.sql creó chk_users_academic_linkage con la regla
-- "TEACHER => faculty_id NOT NULL". La validación de la aplicación ya la
-- trataba como opcional (user.schema.js), por lo que un alta sin facultad
-- terminaba en un error 500 de la base en lugar de guardarse.
--
-- Cada institución usa la facultad (unidad académica) solo si su estructura
-- la tiene. Idempotente.

BEGIN;

ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_users_academic_linkage;

COMMIT;
