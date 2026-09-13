BEGIN;

CREATE TABLE IF NOT EXISTS courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  career_id UUID NOT NULL REFERENCES careers(id) ON DELETE CASCADE,
  code VARCHAR(30) NOT NULL,
  name VARCHAR(150) NOT NULL,
  cycle SMALLINT NOT NULL CHECK (cycle > 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (organization_id, code)
);

CREATE TABLE IF NOT EXISTS teaching_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  academic_period_id UUID NOT NULL REFERENCES academic_periods(id) ON DELETE RESTRICT,
  career_id UUID NOT NULL REFERENCES careers(id) ON DELETE RESTRICT,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
  teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  cycle SMALLINT NOT NULL CHECK (cycle > 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (academic_period_id, course_id, teacher_id)
);

CREATE TABLE IF NOT EXISTS teacher_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  academic_period_id UUID NOT NULL REFERENCES academic_periods(id) ON DELETE RESTRICT,
  teaching_assignment_id UUID NOT NULL REFERENCES teaching_assignments(id) ON DELETE RESTRICT,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  score SMALLINT NOT NULL CHECK (score BETWEEN 1 AND 5),
  comment TEXT,
  is_anonymous BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (teaching_assignment_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_teaching_assignments_scope
  ON teaching_assignments (organization_id, career_id, cycle);
CREATE INDEX IF NOT EXISTS idx_teacher_evaluations_reporting
  ON teacher_evaluations (organization_id, teacher_id, academic_period_id);

COMMIT;
