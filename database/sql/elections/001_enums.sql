-- // 001_enums.sql (Refactorizado)

BEGIN;

DO $$ BEGIN
    CREATE TYPE election_process_type AS ENUM ('VOTE', 'FAIR', 'FEEDBACK', 'FORM');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE election_scope_type AS ENUM ('UNIVERSITY', 'FACULTY', 'PROGRAM');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE election_status_type AS ENUM ('DRAFT', 'SCHEDULED', 'OPEN', 'CLOSED', 'CERTIFIED', 'PUBLISHED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMIT;