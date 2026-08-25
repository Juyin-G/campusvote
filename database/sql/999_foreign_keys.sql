-- Relación Organization Request -> User
ALTER TABLE organization_requests 
  ADD CONSTRAINT fk_org_requests_reviewed_by 
  FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL;