BEGIN;

-- VISTA: DETALLES PÚBLICOS DE LA ELECCIÓN
CREATE OR REPLACE VIEW v_public_election_details AS
WITH candidate_data AS (
    -- 1. Candidatos aprobados agrupados por lista y cargo
    SELECT 
        c.candidate_list_id,
        c.position_id,
        jsonb_agg(
            jsonb_build_object(
                'order_index', c.order_index,
                'is_principal', c.is_principal
            ) ORDER BY c.order_index ASC
        ) AS candidates
    FROM candidacies c
    WHERE c.status = 'APPROVED'
    GROUP BY c.candidate_list_id, c.position_id
),
position_data AS (
    -- 2. Cargos asociados a listas aprobadas
    SELECT 
        cl.id AS candidate_list_id,
        jsonb_agg(
            jsonb_build_object(
                'position_name', p.name,
                'candidates', COALESCE(cd.candidates, '[]'::jsonb)
            ) ORDER BY p.name ASC
        ) AS positions
    FROM candidate_lists cl
    JOIN positions p ON p.election_id = cl.election_id
    LEFT JOIN candidate_data cd 
        ON cd.candidate_list_id = cl.id 
       AND cd.position_id = p.id
    WHERE EXISTS (
        SELECT 1 FROM candidacies c2
        WHERE c2.candidate_list_id = cl.id AND c2.status = 'APPROVED'
    )
    GROUP BY cl.id
),
list_data AS (
    -- 3. Listas aprobadas agrupadas por elección
    SELECT 
        cl.election_id,
        jsonb_agg(
            jsonb_build_object(
                'list_id', cl.id,
                'name', cl.name,
                'acronym', cl.acronym,
                'motto', cl.motto,
                'logo', cl.logo,
                'positions', COALESCE(pd.positions, '[]'::jsonb)
            ) ORDER BY cl.name ASC
        ) AS candidate_lists
    FROM candidate_lists cl
    LEFT JOIN position_data pd ON pd.candidate_list_id = cl.id
    WHERE EXISTS (
        SELECT 1 FROM candidacies c2
        WHERE c2.candidate_list_id = cl.id AND c2.status = 'APPROVED'
    )
    GROUP BY cl.election_id
)
-- 4. Elecciones visibles al público (excluye DRAFT)
SELECT 
    e.id AS election_id,
    e.title,
    e.description,
    e.process_type,
    e.scope_type,
    e.start_at,
    e.end_at,
    e.status,
    COALESCE(ld.candidate_lists, '[]'::jsonb) AS candidate_lists
FROM elections e
LEFT JOIN list_data ld ON ld.election_id = e.id
WHERE e.status NOT IN ('DRAFT');

-- PERMISOS
GRANT SELECT ON v_public_election_details TO app_user;

COMMIT;