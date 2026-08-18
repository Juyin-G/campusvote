BEGIN;

-- ENUMS PARA ELECCIONES

DO $$
BEGIN
    CREATE TYPE election_process_type AS ENUM (
        'VOTE',
        'FAIR',
        'FEEDBACK',
        'FORM'
    );

    CREATE TYPE election_scope_type AS ENUM (
        'UNIVERSITY',
        'FACULTY',
        'PROGRAM'
    );

    CREATE TYPE election_status_type AS ENUM (
        'DRAFT',
        'SCHEDULED',
        'OPEN',
        'CLOSED',
        'CERTIFIED',
        'PUBLISHED'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

COMMIT;