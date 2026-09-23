-- fairs/019_fair_public_registration.sql
-- INSCRIPCIÓN PÚBLICA DE PROYECTOS.
--
-- El admin crea la feria y, cuando quiere, HABILITA el enlace público. Recién
-- ahí se genera public_token y la página de inscripciones responde. Al
-- deshabilitarlo (o al llegar el cierre de inscripción) el enlace deja de
-- funcionar sin borrar nada.
--
-- Quien entra por el enlace demuestra que el correo institucional es suyo con
-- un código de 6 dígitos; fair_registration_codes guarda el hash de ese código
-- y el hash del permiso temporal que se entrega al validarlo. Nunca se guarda
-- el código ni el permiso en claro.

BEGIN;

-- 1) COLUMNAS DE LA FERIA ----------------------------------------------------

ALTER TABLE fairs
    ADD COLUMN IF NOT EXISTS academic_period_id          UUID,
    ADD COLUMN IF NOT EXISTS public_registration_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS public_token                VARCHAR(64),
    ADD COLUMN IF NOT EXISTS public_token_created_at     TIMESTAMPTZ;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'fk_fairs_academic_period'
          AND conrelid = 'public.fairs'::regclass
    ) THEN
        ALTER TABLE fairs
            ADD CONSTRAINT fk_fairs_academic_period
            FOREIGN KEY (academic_period_id) REFERENCES academic_periods(id)
            ON DELETE RESTRICT;
    END IF;

    -- El enlace habilitado SIEMPRE tiene token: sin token no hay página.
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_fairs_public_token_required'
          AND conrelid = 'public.fairs'::regclass
    ) THEN
        ALTER TABLE fairs
            ADD CONSTRAINT chk_fairs_public_token_required
            CHECK (public_registration_enabled = FALSE OR public_token IS NOT NULL);
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_fairs_public_token
    ON fairs (public_token)
    WHERE public_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fairs_academic_period
    ON fairs (academic_period_id);

COMMENT ON COLUMN fairs.academic_period_id IS
    'Período académico al que pertenece la feria (opcional).';
COMMENT ON COLUMN fairs.public_token IS
    'Código del enlace público de inscripciones. Se genera al habilitarlo.';

-- 2) CÓDIGOS DE ACCESO DE LA PÁGINA PÚBLICA ----------------------------------

CREATE TABLE IF NOT EXISTS fair_registration_codes (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fair_id            UUID NOT NULL REFERENCES fairs(id) ON DELETE CASCADE,
    user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- SHA-256 del código de 6 dígitos enviado por correo.
    code_hash          CHAR(64) NOT NULL,
    attempts           SMALLINT NOT NULL DEFAULT 0,
    expires_at         TIMESTAMPTZ NOT NULL,
    consumed_at        TIMESTAMPTZ,

    -- SHA-256 del permiso temporal entregado al validar el código.
    session_hash       CHAR(64),
    session_expires_at TIMESTAMPTZ,

    created_at         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_fair_registration_codes_attempts
        CHECK (attempts >= 0),
    CONSTRAINT chk_fair_registration_codes_session
        CHECK ((session_hash IS NULL) = (session_expires_at IS NULL))
);

CREATE INDEX IF NOT EXISTS idx_fair_registration_codes_lookup
    ON fair_registration_codes (fair_id, user_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_fair_registration_codes_session
    ON fair_registration_codes (session_hash)
    WHERE session_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fair_registration_codes_expires
    ON fair_registration_codes (expires_at);

COMMENT ON TABLE fair_registration_codes IS
    'Verificación de correo para la página pública de inscripción de proyectos.';

COMMIT;
