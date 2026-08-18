BEGIN;

-- TABLA: ELECTION RESULTS (ACTA CONSOLIDADA)

CREATE TABLE IF NOT EXISTS election_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    election_id UUID NOT NULL UNIQUE REFERENCES elections(id) ON DELETE CASCADE,

    total_voters INTEGER NOT NULL DEFAULT 0,
    total_votes_cast INTEGER NOT NULL DEFAULT 0,
    turnout_percentage NUMERIC(5, 2) NOT NULL DEFAULT 0,

    blank_votes INTEGER NOT NULL DEFAULT 0,
    null_votes INTEGER NOT NULL DEFAULT 0,

    certified_at TIMESTAMPTZ NULL,
    published_at TIMESTAMPTZ NULL,

    report_pdf VARCHAR(500) NULL,
    report_hash VARCHAR(64) NULL,
    report_signature TEXT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_results_turnout_percentage CHECK (turnout_percentage >= 0 AND turnout_percentage <= 100),

    CONSTRAINT chk_results_counts_non_negative CHECK (
        total_voters >= 0 AND
        total_votes_cast >= 0 AND
        blank_votes >= 0 AND
        null_votes >= 0
    ),

    -- Los votos emitidos no pueden superar el número de electores habilitados
    CONSTRAINT chk_results_votes_lte_voters CHECK (
        total_votes_cast <= total_voters
    ),

    CONSTRAINT chk_results_blank_null_logic CHECK (
        (blank_votes + null_votes) <= total_votes_cast
    ),

    CONSTRAINT chk_results_dates_logic CHECK (
        published_at IS NULL OR certified_at IS NULL OR published_at >= certified_at
    ),

    CONSTRAINT chk_results_report_integrity CHECK (
        (report_pdf IS NULL AND report_hash IS NULL AND report_signature IS NULL) OR
        (report_pdf IS NOT NULL AND report_hash IS NOT NULL AND length(report_hash) = 64 AND report_signature IS NOT NULL AND length(trim(report_signature)) > 0)
    )
);

-- TRIGGER: ACTUALIZAR updated_at EN ELECTION_RESULTS

DROP TRIGGER IF EXISTS trg_election_results_updated_at ON election_results;

CREATE TRIGGER trg_election_results_updated_at
BEFORE UPDATE ON election_results
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

COMMIT;