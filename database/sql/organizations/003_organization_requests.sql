BEGIN;

-- TABLA: SOLICITUDES DE ORGANIZACIÓN (LEAD GENERATION / ONBOARDING)

CREATE TABLE IF NOT EXISTS organization_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    institution_name VARCHAR(200) NOT NULL,
    institution_type organization_type NOT NULL,
    country VARCHAR(100) NOT NULL,
    estimated_members INTEGER NOT NULL,

    contact_email CITEXT NOT NULL,
    contact_phone VARCHAR(20) NULL,
    message TEXT NULL,

    status organization_request_status NOT NULL DEFAULT 'PENDING',

    reviewed_by UUID NULL
        REFERENCES users(id)
        ON DELETE SET NULL,

    reviewed_at TIMESTAMPTZ NULL,
    rejection_reason TEXT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_req_name_not_empty CHECK (length(trim(institution_name)) > 0),
    CONSTRAINT chk_req_members_positive CHECK (estimated_members > 0),

    CONSTRAINT chk_req_email_format CHECK (
        contact_email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
    ),

    CONSTRAINT chk_req_rejection_reason_mandatory CHECK (
        status != 'REJECTED' OR (rejection_reason IS NOT NULL AND length(trim(rejection_reason)) > 0)
    ),

    CONSTRAINT chk_req_rejection_null_when_not_rejected CHECK (
        status = 'REJECTED' OR rejection_reason IS NULL
    ),

    CONSTRAINT chk_req_reviewed_fields_mandatory CHECK (
        status = 'PENDING' OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)
    )
);

-- ÍNDICES: ORGANIZATION_REQUESTS

CREATE INDEX IF NOT EXISTS idx_org_requests_status
    ON organization_requests (status);

CREATE INDEX IF NOT EXISTS idx_org_requests_email
    ON organization_requests (contact_email);

CREATE INDEX IF NOT EXISTS idx_org_requests_reviewed_by
    ON organization_requests (reviewed_by)
    WHERE reviewed_by IS NOT NULL;

-- TRIGGER: ACTUALIZAR updated_at EN ORGANIZATION_REQUESTS

DROP TRIGGER IF EXISTS trg_org_requests_updated_at ON organization_requests;

CREATE TRIGGER trg_org_requests_updated_at
BEFORE UPDATE ON organization_requests
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

COMMIT;