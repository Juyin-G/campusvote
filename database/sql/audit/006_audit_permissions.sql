--src/database/sql/audit/006_audit_permissions.sql

BEGIN;

-- AUDIT LOGS
GRANT SELECT, INSERT ON TABLE audit_logs TO app_user;
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE audit_logs FROM app_user;

-- VOTING ACCESS TOKENS
GRANT SELECT, INSERT, UPDATE ON TABLE voting_access_tokens TO app_user;

-- FUNCIONES PRIVILEGIADAS
REVOKE ALL ON FUNCTION consume_voting_access_token(VARCHAR, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION consume_voting_access_token(VARCHAR, UUID) TO app_user;

REVOKE ALL ON FUNCTION verify_audit_chain() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION verify_audit_chain() TO app_user;

COMMIT;