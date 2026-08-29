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

-- V2: Tipo de estado de candidatura requerido por 005_candidacies.sql y
-- 007_candidacy_documents.sql (antes no existía -> las tablas no se creaban).
DO $$ BEGIN
    CREATE TYPE candidacy_status_type AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMIT;