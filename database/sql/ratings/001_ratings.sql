-- // 001_ratings.sql
-- Calificación por estrellas (jurados → proyectos/candidaturas) en ferias/concursos.

BEGIN;

-- ENUM: ESTADO DE UNA CALIFICACIÓN
DO $$ BEGIN
    CREATE TYPE rating_status AS ENUM ('ACTIVE', 'REVOKED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- TABLA: RATINGS (CALIFICACIONES TRAZABLES)
-- Un jurado (rol JURY) califica UNA VEZ cada proyecto/candidatura con 1-5
-- estrellas y un comentario opcional. La trazabilidad se garantiza porque cada
-- registro conoce su juror_id; el UNIQUE (candidacy_id, juror_id) impide
-- que un jurado califique dos veces el mismo proyecto.
CREATE TABLE IF NOT EXISTS ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    election_id UUID NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
    candidacy_id UUID NOT NULL REFERENCES candidacies(id) ON DELETE CASCADE,
    juror_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    score SMALLINT NOT NULL CHECK (score BETWEEN 1 AND 5),
    comment TEXT NULL,
    status rating_status NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_ratings_candidacy_juror UNIQUE (candidacy_id, juror_id),
    CONSTRAINT chk_ratings_comment_not_empty CHECK (comment IS NULL OR length(trim(comment)) > 0)
);

-- ÍNDICES: RATINGS

CREATE INDEX IF NOT EXISTS idx_ratings_election
    ON ratings (election_id);
CREATE INDEX IF NOT EXISTS idx_ratings_candidacy
    ON ratings (candidacy_id);

-- TRIGGER: ACTUALIZAR updated_at EN RATINGS

DROP TRIGGER IF EXISTS trg_ratings_updated_at ON ratings;

CREATE TRIGGER trg_ratings_updated_at
BEFORE UPDATE ON ratings
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

COMMIT;
