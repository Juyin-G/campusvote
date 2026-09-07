-- academic/010_voter_stake.sql
-- Estamento CONGELADO en el padrón electoral (voter_registries.stake).
-- No es el rol actual del usuario: define el peso electoral (voto ponderado
-- 2/3 docentes / 1/3 estudiantes de la Ley Universitaria peruana) aunque el
-- usuario cambie de rol después de inscribirse.

BEGIN;

DO $$ BEGIN
    CREATE TYPE stake_type AS ENUM ('STUDENT', 'TEACHER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE voter_registries ADD COLUMN IF NOT EXISTS stake stake_type NOT NULL DEFAULT 'STUDENT';

-- Backfill: congela el estamento según el rol que tenía el usuario al
-- momento de crearse el registro en el padrón (aproximación al rol actual
-- para datos históricos; en adelante stake se fija al inscribir).
UPDATE voter_registries vr
SET stake = (CASE WHEN u.role = 'TEACHER' THEN 'TEACHER' ELSE 'STUDENT' END)::stake_type
FROM users u
WHERE vr.user_id = u.id
  AND vr.stake = 'STUDENT'
  AND u.role = 'TEACHER';

COMMIT;