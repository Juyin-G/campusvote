-- // 001_enums.sql (Refactorizado)

BEGIN;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ballot_option_type') THEN
        CREATE TYPE ballot_option_type AS ENUM (
            'CANDIDATE_LIST',
            'BLANK',
            'VOID'
        );
    END IF;
END $$;

COMMIT;