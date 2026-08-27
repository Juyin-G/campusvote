BEGIN;

-- 1. AGREGAR LOCALE A ORGANIZACIONES Y USUARIOS
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS default_locale VARCHAR(10) NOT NULL DEFAULT 'es-PE';

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS preferred_locale VARCHAR(10) NULL;

-- 2. TABLA: DICCIONARIO DE TRADUCCIONES DE LA PLATAFORMA (UI)
CREATE TABLE IF NOT EXISTS platform_translations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    translation_key VARCHAR(150) NOT NULL UNIQUE,
    category VARCHAR(50) NOT NULL DEFAULT 'general',
    values JSONB NOT NULL DEFAULT '{}'::jsonb, 
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_translations_key_format CHECK (translation_key ~ '^[a-z0-9._-]+$'),
    CONSTRAINT chk_translations_values_not_empty CHECK (jsonb_typeof(values) = 'object' AND values != '{}'::jsonb)
);

-- ÍNDICES
CREATE INDEX IF NOT EXISTS idx_translations_category ON platform_translations (category);

-- TRIGGER: updated_at
DROP TRIGGER IF EXISTS trg_translations_updated_at ON platform_translations;
CREATE TRIGGER trg_translations_updated_at
BEFORE UPDATE ON platform_translations
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 3. FUNCIÓN: OBTENER DICCIONARIO DE TRADUCCIONES (Optimizada)
CREATE OR REPLACE FUNCTION get_ui_translations(
    p_locale VARCHAR DEFAULT 'es-PE',
    p_category VARCHAR DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_locale VARCHAR := COALESCE(NULLIF(trim(p_locale), ''), 'es-PE');
    v_lang_base VARCHAR := split_part(v_locale, '-', 1);
    v_result JSONB;
BEGIN
    SELECT COALESCE(
        jsonb_object_agg(
            translation_key, 
            COALESCE(
                values->>v_locale, 
                values->>v_lang_base,
                values->>'es-PE', 
                values->>'es', 
                translation_key
            )
        ),
        '{}'::jsonb
    )
    INTO v_result
    FROM platform_translations
    WHERE (p_category IS NULL OR category = p_category);

    RETURN v_result;
END;
$$;

-- 4. FUNCIÓN: OBTENER EL LOCALE EFECTIVO DE UN USUARIO
CREATE OR REPLACE FUNCTION get_effective_locale(
    p_user_id UUID
)
RETURNS VARCHAR
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT COALESCE(
        (
            SELECT COALESCE(u.preferred_locale, o.default_locale, 'es-PE')
            FROM users u
            LEFT JOIN organizations o ON u.organization_id = o.id
            WHERE u.id = p_user_id
        ),
        'es-PE'
    );
$$;

-- PERMISOS Y GOBERNANZA
REVOKE ALL ON FUNCTION get_ui_translations(VARCHAR, VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_ui_translations(VARCHAR, VARCHAR) TO app_user;

REVOKE ALL ON FUNCTION get_effective_locale(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_effective_locale(UUID) TO app_user;

GRANT SELECT ON platform_translations TO app_user;
REVOKE INSERT, UPDATE, DELETE ON platform_translations FROM app_user;

COMMIT;