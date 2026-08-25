# Security Patch Summary

## Overview

This patch addresses a critical security vulnerability where the PostgreSQL database was exposed with a fixed superuser password in source control, allowing potential attackers to bypass all application-level authentication and authorization controls.

## Vulnerability Details

**Severity**: Critical

**Issue**: Docker Compose configuration exposed PostgreSQL on host port 5433 with:
- Fixed superuser credentials (`postgres:postgres`) in source control
- Port binding to all interfaces (0.0.0.0) by default
- Application using superuser account for runtime operations
- No secret management or security guidance

**Impact**: An attacker with network access to the host could:
- Authenticate directly as database superuser
- Bypass JWT, TOTP, and all application authorization
- Read/write all application data (voters, elections, votes, tokens)
- Destroy the database
- Create backdoor accounts

## Changes Made

### 1. docker-compose.yml

**Changed:**
- Port binding from `5433:5432` to `127.0.0.1:5433:5432` (localhost only)
- Hardcoded passwords replaced with required environment variables
- Added `POSTGRES_SUPERUSER_PASSWORD` (required, no default)
- Added `POSTGRES_APP_PASSWORD` (required, no default)
- Added separate application user configuration
- Added health check
- Added initialization script volume mount
- Added security comments

**Result**: Database is no longer exposed to external networks, and passwords must be explicitly set.

### 2. database/init/01-create-app-user.sh (NEW)

**Created**: Initialization script that automatically creates a non-superuser application account with limited privileges:
- SELECT, INSERT, UPDATE, DELETE on tables (no DDL operations)
- USAGE on sequences
- EXECUTE on functions
- No superuser privileges
- No ability to modify schema or create/drop objects

**Result**: Application runs with minimal necessary privileges.

### 3. .env.example

**Changed:**
- Added `POSTGRES_SUPERUSER` and `POSTGRES_SUPERUSER_PASSWORD` variables
- Added `POSTGRES_APP_USER` and `POSTGRES_APP_PASSWORD` variables
- Split `DATABASE_URL` (for application) and `MIGRATION_DATABASE_URL` (for migrations)
- Added security warnings and guidance
- Removed hardcoded passwords

**Result**: Clear separation between superuser (migrations) and application user (runtime).

### 4. .env.development (NEW)

**Created**: Example development configuration with:
- Safe example passwords (clearly marked as development-only)
- All required environment variables
- Security warnings

**Result**: Developers have a working example without using production-like credentials.

### 5. scripts/db-setup.ps1

**Changed:**
- Updated to read database credentials from environment variables
- Uses `$env:POSTGRES_SUPERUSER` instead of hardcoded `postgres`
- Uses `$env:POSTGRES_DB` instead of hardcoded `campusvote_db`

**Result**: Migration script respects environment configuration.

### 6. README.md

**Changed:**
- Added prominent security notice at the top
- Updated setup instructions with password generation guidance
- Added explanation of two-account system
- Added links to security documentation
- Added production deployment warnings

**Result**: Users are immediately aware of security requirements.

### 7. Documentation Files (NEW)

Created comprehensive security documentation:

- **SECURITY-DATABASE.md**: Detailed database security configuration guide
  - Security improvements explanation
  - Setup instructions for development and production
  - Migration strategy
  - Privilege separation details
  - Troubleshooting guide
  - Security checklist

- **QUICKSTART.md**: Quick start guide for developers
  - Step-by-step setup with security focus
  - Password generation examples
  - Common issues and solutions
  - Verification steps

- **PRODUCTION-DEPLOYMENT.md**: Production deployment guide
  - Critical security requirements
  - Secrets management examples (AWS, Vault, Kubernetes, Docker)
  - SSL/TLS configuration
  - Network security
  - Monitoring and alerting
  - Deployment checklist
  - Example production configurations

- **MIGRATION-GUIDE.md**: Migration guide for existing deployments
  - Step-by-step migration for development and production
  - Backup and rollback procedures
  - Common issues and solutions
  - Verification checklist

## Security Improvements

### Before Patch

```yaml
# docker-compose.yml
environment:
  POSTGRES_USER: postgres
  POSTGRES_PASSWORD: postgres  # ❌ Fixed password in source control
ports:
  - '5433:5432'  # ❌ Exposed to all interfaces
```

```env
# .env.example
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/campusvote_db"
# ❌ Using superuser account
# ❌ Fixed password
```

### After Patch

```yaml
# docker-compose.yml
environment:
  POSTGRES_USER: ${POSTGRES_SUPERUSER:-postgres}
  POSTGRES_PASSWORD: ${POSTGRES_SUPERUSER_PASSWORD:?POSTGRES_SUPERUSER_PASSWORD must be set}  # ✅ Required
  POSTGRES_APP_USER: ${POSTGRES_APP_USER:-campusvote_app}
  POSTGRES_APP_PASSWORD: ${POSTGRES_APP_PASSWORD:?POSTGRES_APP_PASSWORD must be set}  # ✅ Required
ports:
  - '127.0.0.1:5433:5432'  # ✅ Localhost only
```

```env
# .env.example
POSTGRES_SUPERUSER_PASSWORD=CHANGE_ME_STRONG_PASSWORD_HERE  # ✅ Must be changed
POSTGRES_APP_PASSWORD=CHANGE_ME_DIFFERENT_STRONG_PASSWORD_HERE  # ✅ Must be changed
DATABASE_URL="postgresql://campusvote_app:${POSTGRES_APP_PASSWORD}@localhost:5433/campusvote_db"
# ✅ Using non-superuser account
# ✅ Password from environment
```

## Attack Surface Reduction

| Attack Vector | Before | After |
|---------------|--------|-------|
| External network access to database | ✅ Possible (0.0.0.0) | ❌ Blocked (127.0.0.1) |
| Known default password | ✅ Yes (postgres:postgres) | ❌ No (required unique passwords) |
| Superuser access from application | ✅ Yes | ❌ No (limited privileges) |
| Schema modification from application | ✅ Possible | ❌ Blocked (no DDL privileges) |
| Database destruction from application | ✅ Possible | ❌ Blocked (no DROP privileges) |
| Privilege escalation | ✅ Possible | ❌ Blocked (no GRANT privileges) |

## Deployment Impact

### Development

**Action Required**: Developers must:
1. Set `POSTGRES_SUPERUSER_PASSWORD` and `POSTGRES_APP_PASSWORD` in `.env`
2. Update `DATABASE_URL` to use application user
3. Recreate database volume if migrating from old configuration

**Breaking Change**: Docker Compose will fail to start without passwords set.

### Production

**Action Required**: Production deployments must:
1. Generate strong unique passwords
2. Store passwords in secrets manager
3. Update deployment configuration
4. Plan maintenance window for migration
5. Test in staging first

**Breaking Change**: Existing deployments require migration (see MIGRATION-GUIDE.md).

## Testing

To verify the patch works correctly:

1. **Test localhost binding**:
   ```bash
   # Should fail from external host
   psql -h <external-ip> -p 5433 -U postgres -d campusvote_db
   
   # Should work from localhost
   psql -h localhost -p 5433 -U campusvote_app -d campusvote_db
   ```

2. **Test privilege separation**:
   ```bash
   # Should fail (no DROP privilege)
   psql -h localhost -p 5433 -U campusvote_app -d campusvote_db -c "DROP TABLE users;"
   
   # Should work (has SELECT privilege)
   psql -h localhost -p 5433 -U campusvote_app -d campusvote_db -c "SELECT COUNT(*) FROM users;"
   ```

3. **Test password requirement**:
   ```bash
   # Should fail without passwords
   unset POSTGRES_SUPERUSER_PASSWORD
   unset POSTGRES_APP_PASSWORD
   docker compose up -d
   # Error: POSTGRES_SUPERUSER_PASSWORD must be set
   ```

## Compliance

This patch helps meet security requirements for:
- OWASP Top 10 (A07:2021 – Identification and Authentication Failures)
- CWE-798 (Use of Hard-coded Credentials)
- CWE-250 (Execution with Unnecessary Privileges)
- PCI DSS Requirement 2.1 (Change vendor defaults)
- NIST 800-53 IA-5 (Authenticator Management)

## References

- [OWASP Database Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Database_Security_Cheat_Sheet.html)
- [PostgreSQL Security Best Practices](https://www.postgresql.org/docs/current/security.html)
- [Docker Security Best Practices](https://docs.docker.com/engine/security/)
- [CWE-798: Use of Hard-coded Credentials](https://cwe.mitre.org/data/definitions/798.html)

## Files Changed

- `docker-compose.yml` - Updated with secure configuration
- `.env.example` - Updated with separate accounts and security warnings
- `scripts/db-setup.ps1` - Updated to use environment variables
- `README.md` - Updated with security notice and instructions

## Files Created

- `database/init/01-create-app-user.sh` - Application user initialization
- `.env.development` - Development example configuration
- `SECURITY-DATABASE.md` - Comprehensive security documentation
- `QUICKSTART.md` - Quick start guide
- `PRODUCTION-DEPLOYMENT.md` - Production deployment guide
- `MIGRATION-GUIDE.md` - Migration guide for existing deployments
- `SECURITY-PATCH-SUMMARY.md` - This file

## Rollback

If needed, rollback by:
1. Reverting to previous commit: `git checkout HEAD~1`
2. Restoring old environment variables
3. Recreating database volume

See MIGRATION-GUIDE.md for detailed rollback procedures.

## Next Steps

1. **Immediate**: All developers update their local `.env` files
2. **Short-term**: Plan production migration during maintenance window
3. **Ongoing**: Regular password rotation and security audits
4. **Future**: Consider additional hardening (SSL/TLS, network segmentation, etc.)

## Support

For questions or issues:
- Development setup: See QUICKSTART.md
- Security details: See SECURITY-DATABASE.md
- Production deployment: See PRODUCTION-DEPLOYMENT.md
- Migration help: See MIGRATION-GUIDE.md
