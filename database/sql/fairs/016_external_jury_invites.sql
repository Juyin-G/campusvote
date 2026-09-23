-- Jurados externos invitados por dominio
-- La aceptación depende de `allowed_email_domains` de la organización
-- (Identidad institucional). Idempotente: CREATE IF NOT EXISTS.

BEGIN;

CREATE TABLE IF NOT EXISTS external_jury_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    fair_id UUID NOT NULL REFERENCES fairs(id) ON DELETE CASCADE,
    email VARCHAR(254) NOT NULL,
    full_name VARCHAR(200) NOT NULL,
    document_type VARCHAR(20),
    document_number VARCHAR(50),
    status VARCHAR(20) NOT NULL DEFAULT 'INVITED',
    invited_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    jury_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_external_jury_invites_email_fair
    ON external_jury_invites (email, fair_id);

CREATE INDEX IF NOT EXISTS idx_external_jury_invites_fair
    ON external_jury_invites (fair_id);

CREATE INDEX IF NOT EXISTS idx_external_jury_invites_status
    ON external_jury_invites (status);

CREATE INDEX IF NOT EXISTS idx_external_jury_invites_jury
    ON external_jury_invites (jury_user_id);

COMMIT;