# Migration Guide for Existing Deployments

This guide helps you migrate from the old insecure database configuration to the new secure configuration.

## What Changed?

### Security Improvements

1. **Port Binding**: Database now binds to `127.0.0.1:5433` instead of `0.0.0.0:5433`
2. **Separate Accounts**: New non-superuser application account with limited privileges
3. **No Default Passwords**: All passwords must be explicitly set via environment variables
4. **Privilege Separation**: Application runs with minimal database privileges

### Breaking Changes

- Environment variables `POSTGRES_SUPERUSER_PASSWORD` and `POSTGRES_APP_PASSWORD` are now required
- `DATABASE_URL` must use the new application user account
- Docker Compose will fail to start without passwords set

## Migration Steps

### For Development Environments

#### Step 1: Backup Your Data (Optional but Recommended)

```bash
# Backup your current database
docker exec campusvote_db pg_dump -U postgres -d campusvote_db > backup_before_migration.sql
```

#### Step 2: Stop the Current Database

```bash
docker compose down
```

#### Step 3: Update Your .env File

```bash
# If you don't have a .env file, create one from the example
cp .env.example .env
```

Edit `.env` and add the new required variables:

```env
# Add these new variables
POSTGRES_SUPERUSER=postgres
POSTGRES_SUPERUSER_PASSWORD=your_strong_superuser_password
POSTGRES_APP_USER=campusvote_app
POSTGRES_APP_PASSWORD=your_strong_app_password

# Update your DATABASE_URL to use the application user
DATABASE_URL="postgresql://campusvote_app:your_strong_app_password@localhost:5433/campusvote_db?schema=public"

# Add migration URL for running migrations
MIGRATION_DATABASE_URL="postgresql://postgres:your_strong_superuser_password@localhost:5433/campusvote_db?schema=public"
```

#### Step 4: Remove Old Database Volume (Fresh Start)

**WARNING**: This will delete all existing data. Make sure you have a backup if needed.

```bash
docker compose down -v
```

#### Step 5: Start the New Configuration

```bash
# Start the database with new configuration
npm run db:up

# Wait for it to be ready (check with docker ps)
docker ps

# Run migrations
npm run db:setup
```

#### Step 6: Restore Data (If Needed)

```bash
# If you backed up data, restore it
docker exec -i campusvote_db psql -U postgres -d campusvote_db < backup_before_migration.sql

# Grant privileges to the new application user
docker exec -i campusvote_db psql -U postgres -d campusvote_db <<EOF
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO campusvote_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO campusvote_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO campusvote_app;
EOF
```

#### Step 7: Test the Application

```bash
# Start the application
npm run dev

# Test the health endpoint
curl http://localhost:3000/api/health
```

### For Production Environments

**IMPORTANT**: Plan a maintenance window for this migration.

#### Step 1: Prepare

1. **Schedule Maintenance Window**: Notify users of downtime
2. **Backup Everything**: Database, configuration files, application state
3. **Test Migration in Staging**: Run through these steps in a staging environment first
4. **Prepare Rollback Plan**: Document how to revert if something goes wrong

#### Step 2: Backup Production Database

```bash
# Create a full backup
docker exec campusvote_db pg_dump -U postgres -d campusvote_db -F c -b -v -f /tmp/production_backup.dump

# Copy backup to host
docker cp campusvote_db:/tmp/production_backup.dump ./production_backup_$(date +%Y%m%d_%H%M%S).dump

# Encrypt the backup
gpg --encrypt --recipient your-key-id production_backup_*.dump

# Store securely (e.g., S3)
aws s3 cp production_backup_*.dump.gpg s3://your-backup-bucket/
```

#### Step 3: Generate Strong Passwords

```bash
# Generate strong passwords
SUPERUSER_PASSWORD=$(openssl rand -base64 32)
APP_PASSWORD=$(openssl rand -base64 32)

# Store in your secrets manager
aws secretsmanager create-secret \
  --name campusvote/db/superuser-password \
  --secret-string "$SUPERUSER_PASSWORD"

aws secretsmanager create-secret \
  --name campusvote/db/app-password \
  --secret-string "$APP_PASSWORD"
```

#### Step 4: Update Configuration

Update your production environment variables:

```bash
# Retrieve from secrets manager
export POSTGRES_SUPERUSER_PASSWORD=$(aws secretsmanager get-secret-value \
  --secret-id campusvote/db/superuser-password \
  --query SecretString --output text)

export POSTGRES_APP_PASSWORD=$(aws secretsmanager get-secret-value \
  --secret-id campusvote/db/app-password \
  --query SecretString --output text)

# Set other required variables
export POSTGRES_SUPERUSER=postgres
export POSTGRES_APP_USER=campusvote_app
export POSTGRES_DB=campusvote_db
```

#### Step 5: Stop Application

```bash
# Stop the application (but not the database yet)
# This prevents new data from being written during migration
systemctl stop campusvote  # or however you manage your app
```

#### Step 6: Create Application User in Existing Database

If you want to keep your existing data without recreating the database:

```bash
# Create the application user in the existing database
docker exec -i campusvote_db psql -U postgres -d campusvote_db <<EOF
-- Create application user
CREATE ROLE campusvote_app WITH LOGIN PASSWORD '$POSTGRES_APP_PASSWORD';

-- Grant necessary privileges
GRANT CONNECT ON DATABASE campusvote_db TO campusvote_app;
GRANT USAGE ON SCHEMA public TO campusvote_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO campusvote_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO campusvote_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO campusvote_app;

-- Grant privileges on future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO campusvote_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO campusvote_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO campusvote_app;
EOF
```

#### Step 7: Update Docker Compose Configuration

Pull the latest docker-compose.yml changes:

```bash
git pull origin main
```

Or manually update your docker-compose.yml to match the new secure configuration.

#### Step 8: Restart Database with New Configuration

```bash
# Stop the database
docker compose down

# Start with new configuration
docker compose up -d

# Verify it's healthy
docker ps
docker logs campusvote_db
```

#### Step 9: Update Application Configuration

Update your application's DATABASE_URL to use the new application user:

```bash
export DATABASE_URL="postgresql://campusvote_app:$POSTGRES_APP_PASSWORD@localhost:5433/campusvote_db?schema=public"
```

#### Step 10: Start Application

```bash
# Start the application
systemctl start campusvote  # or however you manage your app

# Monitor logs
journalctl -u campusvote -f
```

#### Step 11: Verify Everything Works

```bash
# Test health endpoint
curl http://localhost:3000/api/health

# Test database connectivity
docker exec -it campusvote_db psql -U campusvote_app -d campusvote_db -c "SELECT COUNT(*) FROM users;"

# Check application logs for errors
```

#### Step 12: Monitor

Monitor the application for at least 24 hours:
- Check error logs
- Monitor database connections
- Verify all features work correctly
- Check performance metrics

### Rollback Procedure

If something goes wrong:

#### Quick Rollback (Revert Configuration)

```bash
# Stop everything
docker compose down

# Revert to old docker-compose.yml
git checkout HEAD~1 docker-compose.yml

# Restore old environment variables
export DATABASE_URL="postgresql://postgres:old_password@localhost:5433/campusvote_db?schema=public"

# Start with old configuration
docker compose up -d

# Start application
systemctl start campusvote
```

#### Full Rollback (Restore Backup)

```bash
# Stop everything
docker compose down -v

# Start database with old configuration
docker compose up -d

# Wait for database to be ready
sleep 10

# Restore backup
docker cp production_backup_TIMESTAMP.dump campusvote_db:/tmp/backup.dump
docker exec campusvote_db pg_restore -U postgres -d campusvote_db -v /tmp/backup.dump

# Start application
systemctl start campusvote
```

## Verification Checklist

After migration, verify:

- [ ] Application starts without errors
- [ ] Database connections work
- [ ] Users can log in
- [ ] All API endpoints respond correctly
- [ ] Database queries execute successfully
- [ ] No permission denied errors in logs
- [ ] Application uses non-superuser account (check logs)
- [ ] Database port is bound to localhost only
- [ ] Passwords are stored securely (not in source control)
- [ ] Backups are working
- [ ] Monitoring is functioning

## Common Issues

### "password authentication failed for user campusvote_app"

The application user doesn't exist or has the wrong password.

**Solution:**
```bash
# Recreate the user with correct password
docker exec -i campusvote_db psql -U postgres -d campusvote_db <<EOF
DROP ROLE IF EXISTS campusvote_app;
CREATE ROLE campusvote_app WITH LOGIN PASSWORD '$POSTGRES_APP_PASSWORD';
-- Grant privileges (see Step 6 above)
EOF
```

### "permission denied for table X"

The application user doesn't have the necessary privileges.

**Solution:**
```bash
# Grant all necessary privileges
docker exec -i campusvote_db psql -U postgres -d campusvote_db <<EOF
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO campusvote_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO campusvote_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO campusvote_app;
EOF
```

### "POSTGRES_SUPERUSER_PASSWORD must be set"

Docker Compose requires the password to be set.

**Solution:**
```bash
# Set the environment variable
export POSTGRES_SUPERUSER_PASSWORD="your_password"

# Or add it to your .env file
echo "POSTGRES_SUPERUSER_PASSWORD=your_password" >> .env
```

### Database won't start after migration

Check the logs:

```bash
docker logs campusvote_db
```

Common causes:
- Invalid environment variables
- Port already in use
- Volume permission issues

**Solution:**
```bash
# Clean start
docker compose down -v
docker compose up -d
```

## Post-Migration Tasks

After successful migration:

1. **Update Documentation**: Document your specific configuration
2. **Update CI/CD**: Update deployment scripts with new environment variables
3. **Update Monitoring**: Ensure monitoring uses correct credentials
4. **Update Backups**: Verify backup scripts work with new configuration
5. **Security Audit**: Review all security settings
6. **Team Training**: Ensure team understands new security model

## Getting Help

If you encounter issues during migration:

1. Check the logs: `docker logs campusvote_db`
2. Review [SECURITY-DATABASE.md](SECURITY-DATABASE.md)
3. Check [QUICKSTART.md](QUICKSTART.md) for setup steps
4. Consult [PRODUCTION-DEPLOYMENT.md](PRODUCTION-DEPLOYMENT.md) for production guidance

For critical production issues, have your rollback plan ready and don't hesitate to use it.
