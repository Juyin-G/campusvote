-- academic/014_academic_periods_organization.sql
-- Los períodos académicos pasan a ser de CADA INSTITUCIÓN.
--
-- Problema que corrige (multi-tenant):
--   academic_periods nació sin organization_id y con una restricción de
--   exclusión GLOBAL: dos períodos ACTIVOS no podían solaparse en fechas
--   aunque fueran de instituciones distintas. En la práctica, si Tecsup
--   activaba su 2026-II, la UNT no podía activar el suyo (fechas solapadas)
--   y, además, activar un período apagaba el de TODAS las organizaciones.
--
-- Solución:
--   1. organization_id en academic_periods (NULL = período heredado, anterior
--      a esta migración; sigue visible para todos).
--   2. La exclusión de fechas se evalúa POR ORGANIZACIÓN.
--   3. Backfill best-effort: si todas las filas que usan un período pertenecen
--      a una sola organización, el período se adopta a esa organización.

BEGIN;

-- Necesaria para combinar "=" sobre uuid con "&&" sobre daterange en GiST.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 1) COLUMNA -----------------------------------------------------------------

ALTER TABLE academic_periods
    ADD COLUMN IF NOT EXISTS organization_id UUID;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'fk_academic_periods_organization'
          AND conrelid = 'public.academic_periods'::regclass
    ) THEN
        ALTER TABLE academic_periods
            ADD CONSTRAINT fk_academic_periods_organization
            FOREIGN KEY (organization_id) REFERENCES organizations(id)
            ON DELETE CASCADE;
    END IF;
END $$;

COMMENT ON COLUMN academic_periods.organization_id IS
    'Institución dueña del período. NULL = período heredado (compartido) creado antes del multi-tenant.';

-- 2) BACKFILL ----------------------------------------------------------------
-- Solo se adopta un período cuando NO hay ambigüedad: todas las filas que lo
-- referencian pertenecen a la misma organización. Los períodos sin uso, o
-- usados por varias organizaciones, se quedan en NULL (compartidos).

DO $$
DECLARE
    v_sql TEXT;
    v_source RECORD;
BEGIN
    FOR v_source IN
        SELECT * FROM (VALUES
            ('elections',           'period_id'),
            ('teaching_assignments','academic_period_id'),
            ('teacher_evaluations', 'academic_period_id')
        ) AS s(table_name, column_name)
    LOOP
        CONTINUE WHEN to_regclass('public.' || v_source.table_name) IS NULL;

        v_sql := format($f$
            UPDATE academic_periods ap
               SET organization_id = origen.organization_id
              FROM (
                    SELECT %I AS period_id, MIN(organization_id::text)::uuid AS organization_id
                      FROM %I
                     WHERE organization_id IS NOT NULL
                     GROUP BY %I
                    HAVING COUNT(DISTINCT organization_id) = 1
                   ) AS origen
             WHERE ap.id = origen.period_id
               AND ap.organization_id IS NULL
        $f$, v_source.column_name, v_source.table_name, v_source.column_name);

        EXECUTE v_sql;
    END LOOP;
END $$;

-- 3) EXCLUSIÓN DE FECHAS POR ORGANIZACIÓN ------------------------------------
-- Antes: un solo período activo por rango de fechas en TODA la plataforma.
-- Ahora: uno por institución. Los períodos heredados (organization_id NULL)
-- no chocan con nadie, porque NULL = NULL no es verdadero en una exclusión.

ALTER TABLE academic_periods
    DROP CONSTRAINT IF EXISTS ex_academic_periods_no_overlap;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'ex_academic_periods_no_overlap_per_org'
          AND conrelid = 'public.academic_periods'::regclass
    ) THEN
        ALTER TABLE academic_periods
            ADD CONSTRAINT ex_academic_periods_no_overlap_per_org
            EXCLUDE USING gist (
                organization_id WITH =,
                daterange(start_date, end_date, '[]') WITH &&
            ) WHERE (is_active = TRUE);
    END IF;
END $$;

-- 4) ÍNDICES -----------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_academic_periods_organization
    ON academic_periods (organization_id);

-- Un mismo nombre ("2026-II") no debe repetirse dentro de una institución.
-- Si la base ya trae duplicados, el índice no se crea y queda el aviso: la
-- migración NO debe tumbar un despliegue por datos históricos.
DO $$
DECLARE
    v_duplicados INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_duplicados
      FROM (
            SELECT organization_id, lower(trim(name))
              FROM academic_periods
             WHERE organization_id IS NOT NULL
             GROUP BY organization_id, lower(trim(name))
            HAVING COUNT(*) > 1
           ) AS d;

    IF v_duplicados > 0 THEN
        RAISE NOTICE 'academic_periods: % nombre(s) duplicado(s) por organización; se omite el índice único uq_academic_periods_org_name', v_duplicados;
    ELSE
        CREATE UNIQUE INDEX IF NOT EXISTS uq_academic_periods_org_name
            ON academic_periods (organization_id, lower(trim(name)))
            WHERE organization_id IS NOT NULL;
    END IF;
END $$;

COMMIT;
