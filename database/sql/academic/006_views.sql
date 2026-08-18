BEGIN;

-- VISTA: PADRÓN ELECTORAL COMPLETO

CREATE OR REPLACE VIEW v_voter_registry_full AS
SELECT
    vr.id,
    vr.user_id,
    u.email,
    u.username,
    u.first_name,
    u.last_name,
    u.institutional_id,
    p.id AS program_id,
    p.name AS program_name,
    p.code AS program_code,
    f.id AS faculty_id,
    f.name AS faculty_name,
    f.code AS faculty_code,
    ap.id AS period_id,
    ap.name AS period_name,
    vr.semester,
    vr.is_eligible,
    vr.eligibility_reason,
    vr.created_at
FROM voter_registries vr
JOIN users u ON vr.user_id = u.id
JOIN programs p ON vr.program_id = p.id
JOIN faculties f ON p.faculty_id = f.id
JOIN academic_periods ap ON vr.period_id = ap.id;

-- VISTA: ESTADÍSTICAS DE VOTANTES POR PROGRAMA Y PERIODO

CREATE OR REPLACE VIEW v_voter_statistics AS
SELECT
    ap.id AS period_id,
    ap.name AS period_name,
    p.id AS program_id,
    p.name AS program_name,
    COUNT(*) FILTER (WHERE vr.is_eligible = TRUE) AS eligible_count,
    COUNT(*) FILTER (WHERE vr.is_eligible = FALSE) AS ineligible_count,
    COUNT(*) AS total_count
FROM voter_registries vr
JOIN academic_periods ap ON vr.period_id = ap.id
JOIN programs p ON vr.program_id = p.id
GROUP BY ap.id, ap.name, p.id, p.name;

COMMIT;