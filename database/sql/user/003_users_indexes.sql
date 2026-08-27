-- // 003_users_indexes.sql (Refactorizado)

BEGIN;

-- ÍNDICES: USERS (Generales)
CREATE INDEX IF NOT EXISTS idx_users_organization_id
    ON users (organization_id);

CREATE INDEX IF NOT EXISTS idx_users_role
    ON users (role);

CREATE INDEX IF NOT EXISTS idx_users_organization_role_active
    ON users (organization_id, role)
    WHERE status = 'ACTIVE'; 

CREATE INDEX IF NOT EXISTS idx_users_date_joined_desc
    ON users (date_joined DESC);

CREATE INDEX IF NOT EXISTS idx_users_locked_until
    ON users (locked_until)
    WHERE locked_until IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_login_lookup
    ON users (email)
    WHERE status = 'ACTIVE';

-- ÍNDICES: CONTEXTO ACADÉMICO Y ELECTORAL

-- Índices básicos por contexto académico
CREATE INDEX IF NOT EXISTS idx_users_faculty_id
    ON users (faculty_id)
    WHERE faculty_id IS NOT NULL AND status = 'ACTIVE'; 

CREATE INDEX IF NOT EXISTS idx_users_program_id
    ON users (program_id)
    WHERE program_id IS NOT NULL AND status = 'ACTIVE'; 

-- Índices compuestos y parciales para reportes y padrones de la Comisión Electoral
CREATE INDEX IF NOT EXISTS idx_users_program_status_student 
    ON users (program_id, status) 
    WHERE role = 'STUDENT';

CREATE INDEX IF NOT EXISTS idx_users_faculty_status_student 
    ON users (faculty_id, status) 
    WHERE role = 'STUDENT';

CREATE INDEX IF NOT EXISTS idx_users_program_cycle_student 
    ON users (program_id, current_cycle) 
    WHERE role = 'STUDENT' AND status = 'ACTIVE'; 

    
-- ÍNDICES ÚNICOS PARCIALES (Soporte Soft Delete)

CREATE UNIQUE INDEX IF NOT EXISTS uq_users_email_active 
    ON users (email) 
    WHERE status != 'DELETED';

CREATE UNIQUE INDEX IF NOT EXISTS uq_users_username_active 
    ON users (username) 
    WHERE status != 'DELETED';

CREATE UNIQUE INDEX IF NOT EXISTS uq_users_institutional_id_active 
    ON users (institutional_id) 
    WHERE status != 'DELETED';

CREATE UNIQUE INDEX IF NOT EXISTS uq_users_google_id_active 
    ON users (google_id) 
    WHERE status != 'DELETED' AND google_id IS NOT NULL;

COMMIT;