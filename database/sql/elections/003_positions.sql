BEGIN;

-- TABLA: CARGOS / POSICIONES (POSITIONS)

CREATE TABLE IF NOT EXISTS positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    election_id UUID NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    description TEXT NULL,
    seats SMALLINT NOT NULL DEFAULT 1,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_positions_election_name UNIQUE (election_id, name),
    CONSTRAINT chk_positions_seats_positive CHECK (seats >= 1),
    CONSTRAINT chk_positions_name_not_empty CHECK (length(trim(name)) > 0)
);

-- TRIGGER: ACTUALIZAR updated_at EN POSITIONS

DROP TRIGGER IF EXISTS trg_positions_updated_at ON positions;

CREATE TRIGGER trg_positions_updated_at
BEFORE UPDATE ON positions
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

COMMIT;