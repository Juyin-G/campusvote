-- 016_relax_teacher_faculty.sql
-- Relaja el CHECK constraint chk_users_academic_linkage que exigia
-- faculty_id NOT NULL para TEACHER. El vinculo academico lo asigna
-- el ADMIN posteriormente o se deriva del codigo institucional al
-- registrarse; el constraint obligaba a enviar faculty_id en la creacion
-- incluso cuando la institucion no lo usa.

BEGIN;

ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_users_academic_linkage;

COMMIT;
