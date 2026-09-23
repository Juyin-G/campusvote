BEGIN;

-- 1. TIPOS DE DATOS (ENUMS)
-- FASE 13: se removieron los tipos electorales (ELECTION_OPENING,
-- VOTE_CONFIRMATION, RESULTS_PUBLISHED, CANDIDACY_APPROVED).
DO $$ BEGIN
    CREATE TYPE notification_type AS ENUM (
        'SYSTEM_ALERT',         -- "Cambio de contraseña exitoso"
        'FAIR_OPENED',          -- "La feria abrió y los jurados pueden calificar"
        'RATING_RECEIVED',      -- "Un jurado calificó el proyecto del expositor"
        'PROJECT_LIKED',        -- "Tu proyecto recibió un nuevo Me gusta"
        'PROJECT_COMMENTED',    -- "Tu proyecto recibió una nueva observación"
        'PROJECT_LIKE_MILESTONE'-- "Tu proyecto alcanzó N Me gusta"
    );
    CREATE TYPE delivery_channel AS ENUM ('IN_APP', 'EMAIL', 'PUSH');
    CREATE TYPE delivery_status AS ENUM ('PENDING', 'SENT', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- V2: Nuevos tipos del flujo de ferias/concursos (Flutter).
-- FAIR_OPENED: la feria abrió y los jurados pueden calificar proyectos.
-- RATING_RECEIVED: un jurado calificó el proyecto del expositor.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'FAIR_OPENED' AND enumtypid = 'notification_type'::regtype) THEN
        ALTER TYPE notification_type ADD VALUE 'FAIR_OPENED';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'RATING_RECEIVED' AND enumtypid = 'notification_type'::regtype) THEN
        ALTER TYPE notification_type ADD VALUE 'RATING_RECEIVED';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'PROJECT_LIKED' AND enumtypid = 'notification_type'::regtype) THEN
        ALTER TYPE notification_type ADD VALUE 'PROJECT_LIKED';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'PROJECT_COMMENTED' AND enumtypid = 'notification_type'::regtype) THEN
        ALTER TYPE notification_type ADD VALUE 'PROJECT_COMMENTED';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'PROJECT_LIKE_MILESTONE' AND enumtypid = 'notification_type'::regtype) THEN
        ALTER TYPE notification_type ADD VALUE 'PROJECT_LIKE_MILESTONE';
    END IF;
END $$;

-- 2. TABLA: NOTIFICACIONES (Bandeja de entrada del usuario)
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type notification_type NOT NULL,
    title VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    read_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_notifications_title_not_empty CHECK (length(trim(title)) > 0),
    CONSTRAINT chk_notifications_message_not_empty CHECK (length(trim(message)) > 0)
);

-- ÍNDICES: NOTIFICATIONS
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread 
    ON notifications (user_id, created_at DESC) 
    WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_user_inbox 
    ON notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_metadata 
    ON notifications USING GIN (metadata);

-- 3. TABLA: LOGS DE ENTREGA (Auditoría y cola de workers)
CREATE TABLE IF NOT EXISTS notification_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
    channel delivery_channel NOT NULL,
    status delivery_status NOT NULL DEFAULT 'PENDING',
    attempt_count INT NOT NULL DEFAULT 0,
    next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    error_message TEXT NULL,
    sent_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_notification_channel UNIQUE (notification_id, channel),
    CONSTRAINT chk_delivery_attempts_positive CHECK (attempt_count >= 0),
    CONSTRAINT chk_delivery_status_consistency CHECK (
        (status = 'SENT' AND sent_at IS NOT NULL) OR
        (status = 'FAILED' AND error_message IS NOT NULL) OR
        (status = 'PENDING')
    )
);

-- ÍNDICES: DELIVERIES
CREATE INDEX IF NOT EXISTS idx_deliveries_pending 
    ON notification_deliveries (next_attempt_at, created_at) 
    WHERE status = 'PENDING';

-- 4. GOBERNANZA DE PERMISOS
GRANT SELECT, UPDATE ON notifications TO app_user;
GRANT SELECT, INSERT, UPDATE ON notification_deliveries TO app_user;

COMMIT;