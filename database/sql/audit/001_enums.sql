BEGIN;

-- ENUM: TIPOS DE ACCIONES DE AUDITORÍA

DO $$
BEGIN
    CREATE TYPE audit_action_type AS ENUM (
        'LOGIN',
        'VERIFY_2FA',
        'CREATE_ELECTION',
        'OPEN_ELECTION',
        'CAST_VOTE',
        'CLOSE_ELECTION',
        'CERTIFY_RESULT',
        'PUBLISH_RESULT'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

COMMIT;