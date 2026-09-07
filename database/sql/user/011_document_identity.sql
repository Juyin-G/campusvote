-- user/011_document_identity.sql
-- Identidad nacional peruana (DNI/CE) en users. Idempotente.
-- Obligatorio en service para JURY / ELECTORAL_COMMISSION / ADMIN y docentes;
-- opcional para estudiantes. La validación externa (RENIEC/PIDE) vive en
-- el IdentityProvider (src/shared/providers/identityProvider.js).

BEGIN;

-- ENUM: TIPO DE DOCUMENTO DE IDENTIDAD
DO $$ BEGIN
    CREATE TYPE document_type AS ENUM ('DNI', 'CE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- COLUMNAS
ALTER TABLE users ADD COLUMN IF NOT EXISTS document_type document_type;
ALTER TABLE users ADD COLUMN IF NOT EXISTS document_number VARCHAR(20);

-- INDICES
CREATE INDEX IF NOT EXISTS idx_users_document_number ON users (document_number);

-- Único parcialmente: (organization_id, document_number) con NULLs permitidos
-- (Postgres no colisiona con NULLs), evitando duplicar un DNI en la misma org.
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_organization_document
    ON users (organization_id, document_number)
    WHERE document_number IS NOT NULL;

-- CHECKS: formato por tipo de documento
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_users_document_dni_format') THEN
        ALTER TABLE users ADD CONSTRAINT chk_users_document_dni_format
            CHECK (document_type IS DISTINCT FROM 'DNI' OR document_number ~ '^[0-9]{8}$');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_users_document_ce_format') THEN
        ALTER TABLE users ADD CONSTRAINT chk_users_document_ce_format
            CHECK (document_type IS DISTINCT FROM 'CE' OR document_number ~ '^[0-9A-Z]{9,12}$');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_users_document_pair') THEN
        ALTER TABLE users ADD CONSTRAINT chk_users_document_pair
            CHECK ((document_type IS NULL) = (document_number IS NULL));
    END IF;
END $$;

COMMIT;