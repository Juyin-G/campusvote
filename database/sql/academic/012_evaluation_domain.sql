-- // 012_evaluation_domain.sql
-- Dominio de Evaluación Académica Docente.
-- Tablas: evaluation_criteria, evaluation_responses, evaluation_response_details.
-- Separado completamente del dominio electoral (ratings/).

BEGIN;

-- ============================================================
-- 1. evaluation_criteria
-- Criterios de evaluación globales por organización.
-- ============================================================

CREATE TABLE IF NOT EXISTS evaluation_criteria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  -- Identifica origen del criterio para migración histórica segura:
  --   NULL = criterio creado normalmente por ADMIN
  --   'TEACHER_EVALUATIONS_MIGRATION' = creado por migración de teacher_evaluations
  migration_source VARCHAR(50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT uq_evaluation_criteria_org_name UNIQUE (organization_id, name)
);

CREATE INDEX IF NOT EXISTS idx_evaluation_criteria_org_active
  ON evaluation_criteria(organization_id, is_active);

DROP TRIGGER IF EXISTS trg_evaluation_criteria_updated_at ON evaluation_criteria;
CREATE TRIGGER trg_evaluation_criteria_updated_at
  BEFORE UPDATE ON evaluation_criteria
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 2. evaluation_responses
-- Una evaluación por estudiante y teaching_assignment.
-- Workflow: DRAFT → SUBMITTED.
-- ============================================================

CREATE TABLE IF NOT EXISTS evaluation_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teaching_assignment_id UUID NOT NULL REFERENCES teaching_assignments(id) ON DELETE RESTRICT,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
  submitted_at TIMESTAMPTZ,
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT uq_evaluation_responses_assignment_student
    UNIQUE (teaching_assignment_id, student_id),
  CONSTRAINT chk_evaluation_responses_status
    CHECK (status IN ('DRAFT', 'SUBMITTED')),
  CONSTRAINT chk_evaluation_responses_submitted CHECK (
    (status = 'SUBMITTED' AND submitted_at IS NOT NULL) OR
    (status = 'DRAFT' AND submitted_at IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_evaluation_responses_student
  ON evaluation_responses(student_id);
CREATE INDEX IF NOT EXISTS idx_evaluation_responses_assignment
  ON evaluation_responses(teaching_assignment_id);

DROP TRIGGER IF EXISTS trg_evaluation_responses_updated_at ON evaluation_responses;
CREATE TRIGGER trg_evaluation_responses_updated_at
  BEFORE UPDATE ON evaluation_responses
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 3. evaluation_response_details
-- Score por criterio dentro de una evaluación.
-- ============================================================

CREATE TABLE IF NOT EXISTS evaluation_response_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_response_id UUID NOT NULL REFERENCES evaluation_responses(id) ON DELETE CASCADE,
  criterion_id UUID NOT NULL REFERENCES evaluation_criteria(id) ON DELETE RESTRICT,
  score SMALLINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT uq_eval_response_details_response_criterion
    UNIQUE (evaluation_response_id, criterion_id),
  CONSTRAINT chk_eval_response_details_score
    CHECK (score BETWEEN 1 AND 5)
);

CREATE INDEX IF NOT EXISTS idx_eval_response_details_response
  ON evaluation_response_details(evaluation_response_id);
CREATE INDEX IF NOT EXISTS idx_eval_response_details_criterion
  ON evaluation_response_details(criterion_id);

COMMIT;
