-- Make the organization boundary explicit on every election.

BEGIN;

ALTER TABLE elections ADD COLUMN IF NOT EXISTS organization_id UUID;

UPDATE elections e
SET organization_id = u.organization_id
FROM users u
WHERE e.created_by = u.id
  AND e.organization_id IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM elections WHERE organization_id IS NULL) THEN
    RAISE EXCEPTION 'Existen elecciones sin organización';
  END IF;
END $$;

ALTER TABLE elections ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE elections DROP CONSTRAINT IF EXISTS elections_organization_id_fkey;
ALTER TABLE elections
  ADD CONSTRAINT elections_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_elections_organization
  ON elections (organization_id);

COMMIT;
