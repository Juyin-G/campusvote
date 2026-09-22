-- academic/013_evaluation_response_status.sql
-- Estado de las respuestas de evaluación docente como ENUM.
--
-- 012_evaluation_domain.sql crea evaluation_responses.status como VARCHAR,
-- pero el esquema de Prisma (evaluation.prisma) lo declara con el enum
-- evaluation_response_status: sin el tipo, toda consulta a esas tablas falla
-- con "type public.evaluation_response_status does not exist".
--
-- Antes esto solo lo hacía tests/setup-db.js con SQL en línea, así que las
-- pruebas pasaban y producción quedaba sin el tipo. Idempotente.

BEGIN;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'evaluation_response_status') THEN
        CREATE TYPE evaluation_response_status AS ENUM ('DRAFT', 'SUBMITTED');
    END IF;
END
$$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_name = 'evaluation_responses'
           AND column_name = 'status'
           AND data_type = 'character varying'
    ) THEN
        ALTER TABLE evaluation_responses
            ALTER COLUMN status DROP DEFAULT,
            ALTER COLUMN status TYPE evaluation_response_status
                USING status::evaluation_response_status,
            ALTER COLUMN status SET DEFAULT 'DRAFT';
    END IF;
END
$$;

COMMIT;
