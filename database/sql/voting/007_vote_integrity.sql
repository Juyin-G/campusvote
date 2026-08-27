-- sql/voting/007_vote_integrity.sql

BEGIN;

CREATE OR REPLACE FUNCTION verify_vote_integrity(
    p_vote_id UUID
)
RETURNS TABLE (
    vote_id UUID,
    election_id UUID,
    is_valid BOOLEAN,
    stored_hash VARCHAR,
    computed_hash VARCHAR,
    cast_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_vote RECORD;
    v_computed_hash VARCHAR;
BEGIN
    SELECT * INTO v_vote
    FROM votes
    WHERE id = p_vote_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Voto no encontrado: %', p_vote_id;
    END IF;

    v_computed_hash := encode(digest(v_vote.encrypted_payload, 'sha512'), 'hex');

    RETURN QUERY SELECT
        v_vote.id,
        v_vote.election_id,
        (v_vote.payload_hash = v_computed_hash),
        v_vote.payload_hash,
        v_computed_hash,
        v_vote.cast_at;
END;
$$;

REVOKE ALL ON FUNCTION verify_vote_integrity(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION verify_vote_integrity(UUID) TO app_user;


CREATE OR REPLACE FUNCTION verify_election_integrity(
    p_election_id UUID
)
RETURNS TABLE (
    total_votes BIGINT,
    valid_votes BIGINT,
    tampered_votes BIGINT,
    integrity_rate NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_total BIGINT;
    v_valid BIGINT;
BEGIN
    SELECT COUNT(*) INTO v_total
    FROM votes
    WHERE election_id = p_election_id;

    IF v_total = 0 THEN
        RETURN QUERY SELECT 0::BIGINT, 0::BIGINT, 0::BIGINT, 100.00::NUMERIC;
        RETURN;
    END IF;

    SELECT COUNT(*) INTO v_valid
    FROM votes
    WHERE election_id = p_election_id
      AND payload_hash = encode(digest(encrypted_payload, 'sha512'), 'hex');

    RETURN QUERY SELECT
        v_total,
        v_valid,
        (v_total - v_valid),
        ROUND((v_valid::NUMERIC / v_total::NUMERIC) * 100, 2);
END;
$$;

REVOKE ALL ON FUNCTION verify_election_integrity(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION verify_election_integrity(UUID) TO app_user;

COMMIT;