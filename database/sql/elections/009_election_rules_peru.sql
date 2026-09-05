-- elections/009_election_rules_peru.sql
-- Reglas electorales peruanas en election_rules:
-- voto ponderado por estamento, quórum diferenciado y voto popular de ferias.

BEGIN;

DO $$ BEGIN
    CREATE TYPE quorum_fail_policy AS ENUM ('VOID_ELECTION', 'VOID_STAKE', 'SECOND_ROUND');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE election_rules ADD COLUMN IF NOT EXISTS is_weighted BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE election_rules ADD COLUMN IF NOT EXISTS teacher_weight NUMERIC(5,2) NOT NULL DEFAULT 0.67;
ALTER TABLE election_rules ADD COLUMN IF NOT EXISTS student_weight NUMERIC(5,2) NOT NULL DEFAULT 0.33;
ALTER TABLE election_rules ADD COLUMN IF NOT EXISTS min_teacher_turnout NUMERIC(5,2) NOT NULL DEFAULT 0;
ALTER TABLE election_rules ADD COLUMN IF NOT EXISTS min_student_turnout NUMERIC(5,2) NOT NULL DEFAULT 0;
ALTER TABLE election_rules ADD COLUMN IF NOT EXISTS quorum_fail_policy quorum_fail_policy NOT NULL DEFAULT 'VOID_ELECTION';
ALTER TABLE election_rules ADD COLUMN IF NOT EXISTS jury_weight NUMERIC(5,2) NOT NULL DEFAULT 0.80;
ALTER TABLE election_rules ADD COLUMN IF NOT EXISTS public_weight NUMERIC(5,2) NOT NULL DEFAULT 0.20;
ALTER TABLE election_rules ADD COLUMN IF NOT EXISTS tie_breaker_criterion_id UUID;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_election_rules_weighted_sum') THEN
        ALTER TABLE election_rules
            ADD CONSTRAINT chk_election_rules_weighted_sum
            CHECK (NOT is_weighted OR (teacher_weight + student_weight = 1.00));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_election_rules_fair_sum') THEN
        ALTER TABLE election_rules
            ADD CONSTRAINT chk_election_rules_fair_sum
            CHECK (jury_weight + public_weight = 1.00);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_election_rules_percent_ranges') THEN
        ALTER TABLE election_rules
            ADD CONSTRAINT chk_election_rules_percent_ranges
            CHECK (
                teacher_weight BETWEEN 0 AND 1 AND
                student_weight BETWEEN 0 AND 1 AND
                min_teacher_turnout BETWEEN 0 AND 100 AND
                min_student_turnout BETWEEN 0 AND 100 AND
                jury_weight BETWEEN 0 AND 1 AND
                public_weight BETWEEN 0 AND 1
            );
    END IF;
END $$;

-- Índice para el criterio de desempate (FK diferida al create de feria_criteria)
CREATE INDEX IF NOT EXISTS idx_election_rules_tie_breaker ON election_rules (tie_breaker_criterion_id) WHERE tie_breaker_criterion_id IS NOT NULL;

COMMIT;