BEGIN;

-- FUNCIÓN: RECALCULAR TURNOUT_PERCENTAGE AUTOMÁTICAMENTE

CREATE OR REPLACE FUNCTION recalculate_turnout_percentage()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.total_voters > 0 THEN
        NEW.turnout_percentage := ROUND((NEW.total_votes_cast::NUMERIC / NEW.total_voters::NUMERIC) * 100, 2);
    ELSE
        NEW.turnout_percentage := 0;
    END IF;

    RETURN NEW;
END;
$$;

-- TRIGGER: RECALCULAR EN INSERT/UPDATE

DROP TRIGGER IF EXISTS trg_recalculate_turnout ON election_results;

CREATE TRIGGER trg_recalculate_turnout
BEFORE INSERT OR UPDATE OF total_voters, total_votes_cast ON election_results
FOR EACH ROW
EXECUTE FUNCTION recalculate_turnout_percentage();

COMMIT;