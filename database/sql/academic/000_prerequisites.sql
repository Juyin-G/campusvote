-- 000_prerequisites.sql
BEGIN;
    
DO $$
BEGIN
   IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'app_user') THEN
      CREATE ROLE app_user;
   END IF;
END
$$;

-- 3. FUNCIÓN GENÉRICA PARA ACTUALIZAR TIMESTAMPS EN TRIGGERS
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

COMMIT;