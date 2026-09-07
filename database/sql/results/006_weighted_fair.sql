--src/database/sql/results/006_weighted_fair.sql

BEGIN;

-- 1. COLUMNA stake EN TALLIES (desglose de escrutinio por estamento)
ALTER TABLE tallies ADD COLUMN IF NOT EXISTS stake stake_type;

-- El UNIQUE es ahora (election_id, position_id, option_id, stake): el convoy
-- agregado (stake NULL, escrito por tally_election_votes) y el desglosado
-- por estamento conviven sin colisionar.
ALTER TABLE tallies DROP CONSTRAINT IF EXISTS uq_tallies_election_position_option;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_tallies_election_position_option_stake') THEN
        ALTER TABLE tallies ADD CONSTRAINT uq_tallies_election_position_option_stake
            UNIQUE (election_id, position_id, option_id, stake);
    END IF;
END $$;

-- 2. COLUMNAS DE METADATA EN ELECTION_RESULTS
ALTER TABLE election_results ADD COLUMN IF NOT EXISTS weighted_config JSONB;
ALTER TABLE election_results ADD COLUMN IF NOT EXISTS fair_ranking JSONB;

-- 2b. DESEMPATE (F7): resolución registrada, nunca mezclada con conteos.
ALTER TABLE election_results ADD COLUMN IF NOT EXISTS tie_break_applied BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE election_results ADD COLUMN IF NOT EXISTS tie_break_winner_id UUID;
ALTER TABLE election_results ADD COLUMN IF NOT EXISTS tie_break_at TIMESTAMPTZ;

-- 3. ESCRUTINIO PONDERADO: conta por opción y por estamento (patrón de
--    tally_election_votes pero agrupando por voter_registries.stake)
CREATE OR REPLACE FUNCTION compute_weighted_tallies(
    p_election_id UUID,
    p_teacher_weight NUMERIC,
    p_student_weight NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_status VARCHAR(20);
    v_weights_sum NUMERIC;
BEGIN
    IF p_teacher_weight < 0 OR p_student_weight < 0 OR
       p_teacher_weight + p_student_weight <> 1.00 THEN
        RAISE EXCEPTION 'Los pesos deben sumar exactamente 1.00 (docentes + estudiantes).';
    END IF;

    SELECT status INTO v_status FROM elections WHERE id = p_election_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Elección no encontrada.';
    END IF;
    IF v_status != 'CLOSED' THEN
        RAISE EXCEPTION 'El escrutinio ponderado solo se realiza en elecciones CERRADAS. Estado actual: %', v_status;
    END IF;

    -- Limpia únicamente el desglose por estamento (el agregado NULL se conserva)
    DELETE FROM tallies WHERE election_id = p_election_id AND stake IS NOT NULL;

    INSERT INTO tallies (election_id, position_id, option_id, votes_count, stake)
    SELECT
        v.election_id,
        bp.position_id,
        vs.ballot_option_id,
        COUNT(*)::INTEGER,
        vr.stake
    FROM votes v
    JOIN vote_selections vs ON v.id = vs.vote_id
    JOIN ballot_options bo ON vs.ballot_option_id = bo.id
    JOIN ballot_positions bp ON bo.ballot_position_id = bp.id
    JOIN voter_registries vr ON vr.user_id = v.voter_id
        AND vr.period_id = (SELECT period_id FROM elections WHERE id = p_election_id)
        AND vr.is_eligible = TRUE
    WHERE v.election_id = p_election_id
    GROUP BY v.election_id, bp.position_id, vs.ballot_option_id, vr.stake;
END;
$$;

REVOKE ALL ON FUNCTION compute_weighted_tallies(UUID, NUMERIC, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION compute_weighted_tallies(UUID, NUMERIC, NUMERIC) TO app_user;

-- 4. CERTIFICACIÓN PONDERADA: quórum por estamento diferenciado + acta con
--    configuración aplicada. Devuelve el id de election_results.
CREATE OR REPLACE FUNCTION certify_weighted_election(
    p_election_id UUID,
    p_certifier_user_id UUID,
    p_teacher_weight NUMERIC,
    p_student_weight NUMERIC,
    p_min_teacher_turnout NUMERIC,
    p_min_student_turnout NUMERIC,
    p_quorum_fail_policy quorum_fail_policy
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_status VARCHAR(20);
    v_role VARCHAR(50);
    v_period_id UUID;
    v_eligible_teachers INTEGER;
    v_eligible_students INTEGER;
    v_voted_teachers INTEGER;
    v_voted_students INTEGER;
    v_teacher_turnout NUMERIC;
    v_student_turnout NUMERIC;
    v_teacher_ok BOOLEAN;
    v_student_ok BOOLEAN;
    v_result_id UUID;
BEGIN
    -- Autorización explícita
    SELECT role INTO v_role FROM users WHERE id = p_certifier_user_id AND status = 'ACTIVE';
    IF v_role IS NULL OR v_role NOT IN ('ADMIN', 'ELECTORAL_COMMISSION') THEN
        RAISE EXCEPTION 'Usuario no autorizado para certificar la elección.';
    END IF;

    SELECT status, period_id INTO v_status, v_period_id FROM elections WHERE id = p_election_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Elección no encontrada.';
    END IF;
    IF v_status != 'CLOSED' THEN
        RAISE EXCEPTION 'No se puede certificar una elección que no está CERRADA. Estado actual: %', v_status;
    END IF;

    -- Padrón y voto por estamento (stake CONGELADO en voter_registries)
    SELECT
        COUNT(*) FILTER (WHERE vr.stake = 'TEACHER'),
        COUNT(*) FILTER (WHERE vr.stake = 'STUDENT')
    INTO v_eligible_teachers, v_eligible_students
    FROM voter_registries vr
    WHERE vr.period_id = v_period_id AND vr.is_eligible = TRUE;

    SELECT
        COUNT(*) FILTER (WHERE vr.stake = 'TEACHER'),
        COUNT(*) FILTER (WHERE vr.stake = 'STUDENT')
    INTO v_voted_teachers, v_voted_students
    FROM votes v
    JOIN voter_registries vr ON vr.user_id = v.voter_id AND vr.period_id = v_period_id AND vr.is_eligible = TRUE
    WHERE v.election_id = p_election_id;

    -- Un estamento sin electores se considera satisfecho (vacío)
    v_teacher_turnout := CASE WHEN v_eligible_teachers > 0
                             THEN round((100.0 * v_voted_teachers / v_eligible_teachers)::numeric, 2)
                             ELSE 100 END;
    v_student_turnout := CASE WHEN v_eligible_students > 0
                             THEN round((100.0 * v_voted_students / v_eligible_students)::numeric, 2)
                             ELSE 100 END;

    v_teacher_ok := v_teacher_turnout >= COALESCE(p_min_teacher_turnout, 0);
    v_student_ok := v_student_turnout >= COALESCE(p_min_student_turnout, 0);

    IF NOT (v_teacher_ok OR v_student_ok) OR (p_quorum_fail_policy = 'VOID_ELECTION' AND NOT (v_teacher_ok AND v_student_ok)) THEN
        RAISE EXCEPTION 'QUORUM_FAILED: docentes %%% (mín %%%), estudiantes %%% (mín %%%).',
            v_teacher_turnout, COALESCE(p_min_teacher_turnout, 0),
            v_student_turnout, COALESCE(p_min_student_turnout, 0);
    END IF;

    -- Escrutinio ponderado (desglosado) dentro de la misma transacción
    PERFORM compute_weighted_tallies(p_election_id, p_teacher_weight, p_student_weight);

    -- Acta con la configuración de pesos y quórum aplicada
    INSERT INTO election_results (election_id, weighted_config)
    VALUES (
        p_election_id,
        jsonb_build_object(
            'teacher_weight', p_teacher_weight,
            'student_weight', p_student_weight,
            'min_teacher_turnout', COALESCE(p_min_teacher_turnout, 0),
            'min_student_turnout', COALESCE(p_min_student_turnout, 0),
            'quorum_fail_policy', p_quorum_fail_policy,
            'teacher_turnout', v_teacher_turnout,
            'student_turnout', v_student_turnout,
            'teacher_quorum_met', v_teacher_ok,
            'student_quorum_met', v_student_ok,
            'certified_at', to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
        )
    )
    ON CONFLICT (election_id) DO UPDATE SET
        weighted_config = EXCLUDED.weighted_config,
        certified_at = CURRENT_TIMESTAMP
    RETURNING id INTO v_result_id;

    UPDATE elections SET status = 'CERTIFIED' WHERE id = p_election_id;

    RETURN v_result_id;
END;
$$;

REVOKE ALL ON FUNCTION certify_weighted_election(UUID, UUID, NUMERIC, NUMERIC, NUMERIC, NUMERIC, quorum_fail_policy) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION certify_weighted_election(UUID, UUID, NUMERIC, NUMERIC, NUMERIC, NUMERIC, quorum_fail_policy) TO app_user;

-- 5. RESULTADOS DE FERIA: blend de rúbricas de jurados (80%) + voto popular
--    (20%), con desempate por criterio dirimente. El ranking se deriva y se
--    deposita en election_results.fair_ranking (no muta tallies ni ratings).
CREATE OR REPLACE FUNCTION finalize_fair_results(
    p_election_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_status VARCHAR(20);
    v_jury_weight NUMERIC;
    v_public_weight NUMERIC;
    v_tie_breaker_id UUID;
    v_ranking JSONB;
    v_top1_final NUMERIC;
    v_top2_final NUMERIC;
    v_winner_tmp UUID;
BEGIN
    SELECT status INTO v_status FROM elections WHERE id = p_election_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Elección no encontrada.';
    END IF;
    IF v_status NOT IN ('CLOSED', 'CERTIFIED') THEN
        RAISE EXCEPTION 'Los resultados de feria requieren CLOSED/CERTIFIED. Estado actual: %', v_status;
    END IF;

    SELECT jury_weight, public_weight, tie_breaker_criterion_id
    INTO v_jury_weight, v_public_weight, v_tie_breaker_id
    FROM election_rules WHERE election_id = p_election_id;

    IF v_jury_weight IS NULL OR v_public_weight IS NULL THEN
        RAISE EXCEPTION 'La feria no tiene pesos de jurado/público configurados.';
    END IF;

    -- Ranking derivado: avg_jurados (ponderado por criterios vía score final)
    -- + pct_voto_popular (normalizado sobre votos emitidos). El ORDER BY ya
    -- aplica la cadena de desempate (final_score, avg, criterio dirimente,
    -- nº de jurados, primer voto).
    WITH jury_scores AS (
        SELECT
            r.candidacy_id,
            ROUND(AVG(r.score)::numeric, 2) AS avg_score,
            ROUND(AVG(d.score) FILTER (WHERE d.criterion_id = v_tie_breaker_id)::numeric, 2) AS tie_score,
            COUNT(*) AS jury_count,
            MIN(r.created_at) AS first_at
        FROM ratings r
        LEFT JOIN rating_details d ON d.rating_id = r.id
        WHERE r.election_id = p_election_id AND r.status = 'ACTIVE'
        GROUP BY r.candidacy_id
    ),
    popular AS (
        SELECT
            bo.candidacy_id,
            ROUND(100.0 * SUM(t.votes_count) / NULLIF((SELECT SUM(t2.votes_count)
                FROM tallies t2 WHERE t2.election_id = p_election_id AND t2.stake IS NULL), 0), 2) AS pct
        FROM tallies t
        JOIN ballot_options bo ON bo.id = t.option_id
        WHERE t.election_id = p_election_id AND t.stake IS NULL
          AND bo.candidacy_id IS NOT NULL
        GROUP BY bo.candidacy_id
    ),
    ranked AS (
        SELECT
            c.id AS candidacy_id,
            COALESCE(js.avg_score, 0) AS avg_score,
            COALESCE(p.pct, 0) AS pct,
            ROUND((COALESCE(js.avg_score,0)/20.0 * v_jury_weight * 100 + COALESCE(p.pct,0) * v_public_weight)::numeric, 2) AS final_score,
            COALESCE(js.tie_score, COALESCE(js.avg_score, 0)) AS tie_score,
            COALESCE(js.jury_count, 0) AS jury_count,
            COALESCE(js.first_at, now()) AS first_at
        FROM candidacies c
        LEFT JOIN jury_scores js ON js.candidacy_id = c.id
        LEFT JOIN popular p ON p.candidacy_id = c.id
        WHERE c.election_id = p_election_id AND c.status = 'ACTIVE'
    ),
    ordered AS (
        SELECT ranked.*, ROW_NUMBER() OVER (
            ORDER BY final_score DESC, avg_score DESC, tie_score DESC, jury_count DESC, first_at ASC
        ) AS rn
        FROM ranked
    )
    SELECT jsonb_agg(jsonb_build_object(
        'candidacy_id', candidacy_id,
        'rank', rn,
        'jury_avg', avg_score,
        'popular_pct', pct,
        'final_score', final_score
    ) ORDER BY rn)
    INTO v_ranking
    FROM ordered;

    -- Marcador de desempate: si el 1º y 2º llegaron empatados en final_score,
    -- el orden del ranking se decidió por desempate; se deja constancia.
    SELECT (e->>'final_score')::numeric FROM jsonb_array_elements(v_ranking) e WHERE e->>'rank' = '1' INTO v_top1_final;
    SELECT (e->>'final_score')::numeric FROM jsonb_array_elements(v_ranking) e WHERE e->>'rank' = '2' INTO v_top2_final;
    SELECT (e->>'candidacy_id')::uuid FROM jsonb_array_elements(v_ranking) e WHERE e->>'rank' = '1' INTO v_winner_tmp;

    UPDATE election_results er
    SET
        fair_ranking = v_ranking,
        tie_break_applied = v_top2_final IS NOT NULL AND v_top1_final = v_top2_final,
        tie_break_winner_id = CASE WHEN v_top2_final IS NOT NULL AND v_top1_final = v_top2_final
                                   THEN v_winner_tmp::UUID ELSE NULL END,
        tie_break_at = CASE WHEN v_top2_final IS NOT NULL AND v_top1_final = v_top2_final
                            THEN CURRENT_TIMESTAMP ELSE NULL END
    WHERE er.election_id = p_election_id;
END;
$$;

REVOKE ALL ON FUNCTION finalize_fair_results(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION finalize_fair_results(UUID) TO app_user;

COMMIT;