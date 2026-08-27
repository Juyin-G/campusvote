-- 003_vote_selections.sql (Refactorizado)

BEGIN;

CREATE TABLE IF NOT EXISTS vote_selections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    vote_id UUID NOT NULL REFERENCES votes(id) ON DELETE CASCADE,
    ballot_option_id UUID NOT NULL REFERENCES ballot_options(id) ON DELETE RESTRICT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_vote_selections_vote_option UNIQUE (vote_id, ballot_option_id)
);

COMMENT ON TABLE vote_selections IS 
'PRIVACIDAD CRÍTICA: Vincula vote_id con selecciones. NUNCA unir con la tabla users ni exponer a roles web públicos.';

CREATE INDEX IF NOT EXISTS idx_vote_selections_vote ON vote_selections (vote_id);
CREATE INDEX IF NOT EXISTS idx_vote_selections_ballot_option ON vote_selections (ballot_option_id);

CREATE OR REPLACE FUNCTION validate_vote_selection_election_match()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_vote_election_id UUID;
    v_option_election_id UUID;
BEGIN
    SELECT election_id INTO v_vote_election_id FROM votes WHERE id = NEW.vote_id;

    SELECT bp.election_id INTO v_option_election_id
    FROM ballot_options bo
    JOIN ballot_positions bp ON bp.id = bo.ballot_position_id
    WHERE bo.id = NEW.ballot_option_id;

    IF v_option_election_id IS DISTINCT FROM v_vote_election_id THEN
        RAISE EXCEPTION 'Inconsistencia relacional: La opción % no pertenece a la elección % del voto %.', 
            NEW.ballot_option_id, v_vote_election_id, NEW.vote_id;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_vote_selections_election_match ON vote_selections;
CREATE TRIGGER trg_vote_selections_election_match
BEFORE INSERT ON vote_selections
FOR EACH ROW
EXECUTE FUNCTION validate_vote_selection_election_match();

GRANT SELECT, INSERT ON vote_selections TO app_user;
REVOKE UPDATE, DELETE ON vote_selections FROM PUBLIC, app_user;

COMMIT;