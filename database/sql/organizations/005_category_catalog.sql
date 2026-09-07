-- organizations/005_category_catalog.sql
-- Catálogo de categorías de ferias/concursos alineado a OCDE (también puede
-- ser personalizado por la organización vía config). candidate_lists.category
-- se valida contra este catálogo en service.

BEGIN;

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS category_catalog JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMIT;