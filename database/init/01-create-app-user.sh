#!/bin/bash
set -e

# This script runs automatically when the PostgreSQL container is first initialized
# It creates a non-superuser application account with limited privileges

echo "Creating application database user..."

# Create the application user if it doesn't exist
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    -- Create application user with limited privileges (not a superuser)
    DO \$\$
    BEGIN
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '$POSTGRES_APP_USER') THEN
            CREATE ROLE $POSTGRES_APP_USER WITH LOGIN PASSWORD '$POSTGRES_APP_PASSWORD';
        END IF;
    END
    \$\$;

    -- Grant necessary privileges for the application to function
    -- Connect to the database
    GRANT CONNECT ON DATABASE $POSTGRES_DB TO $POSTGRES_APP_USER;
    
    -- Grant usage on the public schema
    GRANT USAGE ON SCHEMA public TO $POSTGRES_APP_USER;
    
    -- Grant privileges on all current tables
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO $POSTGRES_APP_USER;
    
    -- Grant privileges on all current sequences
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO $POSTGRES_APP_USER;
    
    -- Grant privileges on future tables (for migrations)
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO $POSTGRES_APP_USER;
    
    -- Grant privileges on future sequences
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO $POSTGRES_APP_USER;
    
    -- Grant execute on functions (needed for stored procedures)
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO $POSTGRES_APP_USER;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO $POSTGRES_APP_USER;

    -- Log the creation
    \echo 'Application user created successfully with limited privileges'
EOSQL

echo "Application user setup complete."
