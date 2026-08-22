CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

-- Función para generar slugs
CREATE OR REPLACE FUNCTION generate_slug(text)
RETURNS text AS $$
  SELECT lower(regexp_replace($1, '[^a-zA-Z0-9]+', '-', 'g'));
$$ LANGUAGE sql IMMUTABLE;

-- Función para normalizar emails
CREATE OR REPLACE FUNCTION normalize_email(email text)
RETURNS text AS $$
  SELECT lower(trim($1));
$$ LANGUAGE sql IMMUTABLE;

-- Función para verificar si es email válido
CREATE OR REPLACE FUNCTION is_valid_email(email text)
RETURNS boolean AS $$
  SELECT $1 ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$';
$$ LANGUAGE sql IMMUTABLE;