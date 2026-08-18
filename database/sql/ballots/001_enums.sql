BEGIN;

-- ENUM: TIPOS DE OPCIONES DE BOLETA

DO $$
BEGIN
    CREATE TYPE ballot_option_type AS ENUM (
        'CANDIDATE_LIST',
        'BLANK',
        'NULL'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

COMMIT;