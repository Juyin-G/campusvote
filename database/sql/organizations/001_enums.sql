BEGIN;

-- ENUMS PARA ORGANIZACIONES

DO $$
BEGIN
    CREATE TYPE organization_type AS ENUM (
        'UNIVERSITY',
        'INSTITUTE',
        'SCHOOL',
        'COMPANY',
        'ASSOCIATION',
        'OTHER'
    );

    CREATE TYPE organization_request_status AS ENUM (
        'PENDING',
        'APPROVED',
        'REJECTED'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

COMMIT;