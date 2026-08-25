# Database Security Configuration

## Overview

This document describes the security measures implemented for the CampusVote database configuration and provides guidance for secure deployment.

## Security Improvements

### 1. Localhost-Only Database Binding

The PostgreSQL port is now bound to `127.0.0.1:5433` instead of `0.0.0.0:5433`. This ensures that:
- The database is only accessible from the host machine
- External network access to the database is prevented by default
- The application must run on the same host or use Docker networking

### 2. Separate Application User

The system now uses two database accounts:

#### Superuser Account (`postgres`)
- **Purpose**: Database initialization, migrations, and administrative tasks only
- **Privileges**: Full superuser access
- **Usage**: Should NEVER be used by the application at runtime
- **Configuration**: Set via `POSTGRES_SUPERUSER_PASSWORD` environment variable

#### Application User (`campusvote_app`)
- **Purpose**: Runtime application database operations
- **Privileges**: Limited to SELECT, INSERT, UPDATE, DELETE on application tables
- **Usage**: Used by the application via `DATABASE_URL`
- **Configuration**: Set via `POSTGRES_APP_PASSWORD` environment variable

### 3. Environment-Based Credentials

All database passwords must now be provided via environment variables:
- `POSTGRES_SUPERUSER_PASSWORD`: Required for database initialization
- `POSTGRES_APP_PASSWORD`: Required for application runtime

These variables have no default values and will cause Docker Compose to fail if not set, preventing accidental deployment with default credentials.

## Setup Instructions

### Development Environment

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and set strong passwords:
   ```bash
   # Generate strong random passwords (example using openssl)
   openssl rand -base64 32  # Use for POSTGRES_SUPERUSER_PASSWORD
   openssl rand -base64 32  # Use for POSTGRES_APP_PASSWORD
   ```

3. Update the passwords in `.env`:
   ```env
   POSTGRES_SUPERUSER_PASSWORD=your_generated_superuser_password
   POSTGRES_APP_PASSWORD=your_generated_app_password
   ```

4. Start the database:
   ```bash
   npm run db:up
   ```

5. Run migrations (uses superuser account):
   ```bash
   npm run db:setup
   ```

6. Start the application (uses application account):
   ```bash
   npm run dev
   ```

### Production Environment

1. **Never commit `.env` files to source control**

2. **Use a secrets management solution**:
   - AWS Secrets Manager
   - HashiCorp Vault
   - Azure Key Vault
   - Kubernetes Secrets
   - Docker Secrets (for Docker Swarm)

3. **Set environment variables securely**:
   ```bash
   export POSTGRES_SUPERUSER_PASSWORD=$(your-secrets-manager get superuser-password)
   export POSTGRES_APP_PASSWORD=$(your-secrets-manager get app-password)
   ```

4. **Use Docker networks instead of port binding**:
   - Remove the `ports` section from `docker-compose.yml`
   - Use Docker's internal networking for container-to-container communication
   - Only expose the application HTTP port through a reverse proxy

5. **Enable SSL/TLS for database connections**:
   - Configure PostgreSQL to require SSL
   - Update `DATABASE_URL` to include `sslmode=require`

6. **Implement additional security measures**:
   - Use connection pooling with connection limits
   - Enable PostgreSQL audit logging
   - Implement network segmentation
   - Use read replicas for read-heavy operations
   - Regular security updates and patches

## Migration Strategy

### Running Migrations

Migrations require elevated privileges to modify the database schema. Use the `MIGRATION_DATABASE_URL` for migration operations:

```bash
# Set the migration connection string
export DATABASE_URL=$MIGRATION_DATABASE_URL

# Run migrations
npm run db:setup

# Restore the application connection string
export DATABASE_URL="postgresql://${POSTGRES_APP_USER}:${POSTGRES_APP_PASSWORD}@localhost:5433/${POSTGRES_DB}?schema=public"
```

### Automated Migration in CI/CD

In CI/CD pipelines, use the superuser account only for the migration step, then switch to the application account for testing:

```yaml
# Example CI/CD configuration
steps:
  - name: Run Migrations
    env:
      DATABASE_URL: ${{ secrets.MIGRATION_DATABASE_URL }}
    run: npm run db:setup
  
  - name: Run Tests
    env:
      DATABASE_URL: ${{ secrets.DATABASE_URL }}
    run: npm test
```

## Privilege Separation

The application user (`campusvote_app`) has the following privileges:

**Granted:**
- CONNECT to the database
- USAGE on the public schema
- SELECT, INSERT, UPDATE, DELETE on all tables
- USAGE, SELECT on all sequences
- EXECUTE on all functions

**Not Granted (requires superuser):**
- CREATE/DROP database
- CREATE/DROP schema
- CREATE/ALTER/DROP tables
- CREATE/ALTER/DROP users/roles
- TRUNCATE tables
- Database configuration changes

This separation ensures that even if the application is compromised, an attacker cannot:
- Destroy the database
- Modify the schema
- Create backdoor accounts
- Access system tables
- Escalate privileges

## Troubleshooting

### Connection Refused

If you get "connection refused" errors:
- Ensure the database container is running: `docker ps`
- Check that you're connecting to `localhost:5433`, not `5432`
- Verify the port binding is correct: `docker port campusvote_db`

### Authentication Failed

If you get authentication errors:
- Verify the passwords in your `.env` file match what was used to initialize the database
- If you changed passwords, you may need to recreate the database volume:
  ```bash
  docker compose down -v
  docker compose up -d
  ```

### Permission Denied

If you get "permission denied" errors during application runtime:
- Ensure you're using `DATABASE_URL` (application user), not `MIGRATION_DATABASE_URL`
- Check that the application user has the necessary privileges
- Re-run the initialization script if needed

## Security Checklist

Before deploying to production:

- [ ] Changed all default passwords
- [ ] Passwords are stored in a secrets manager, not in source control
- [ ] Database is not exposed to the public internet
- [ ] SSL/TLS is enabled for database connections
- [ ] Application uses the non-superuser account at runtime
- [ ] Migrations are run separately with the superuser account
- [ ] Database backups are encrypted and stored securely
- [ ] Audit logging is enabled
- [ ] Regular security updates are scheduled
- [ ] Network segmentation is implemented
- [ ] Connection pooling limits are configured
- [ ] Monitoring and alerting are in place

## References

- [PostgreSQL Security Best Practices](https://www.postgresql.org/docs/current/security.html)
- [OWASP Database Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Database_Security_Cheat_Sheet.html)
- [Docker Security Best Practices](https://docs.docker.com/engine/security/)
