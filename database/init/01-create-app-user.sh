#!/bin/bash
set -e

echo "Creating application database user..."

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    DO \$\$
    BEGIN
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '$POSTGRES_APP_USER') THEN
            CREATE ROLE $POSTGRES_APP_USER WITH LOGIN PASSWORD '$POSTGRES_APP_PASSWORD';
        END IF;
    END
    \$\$;

    GRANT CONNECT ON DATABASE $POSTGRES_DB TO $POSTGRES_APP_USER;
    GRANT USAGE ON SCHEMA public TO $POSTGRES_APP_USER;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO $POSTGRES_APP_USER;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO $POSTGRES_APP_USER;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO $POSTGRES_APP_USER;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO $POSTGRES_APP_USER;
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO $POSTGRES_APP_USER;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO $POSTGRES_APP_USER;

    \echo 'Application user created successfully with limited privileges'
EOSQL

echo "Application user setup complete."

# ==============================================================================
# EJECUCIÓN DE MÓDULOS SQL
# ==============================================================================
echo "Executing database schema migrations..."

BASE_DIR="/database/sql"

# 1. Archivos SQL en la raíz (excluyendo 999_foreign_keys.sql)
for sql_file in "$BASE_DIR"/*.sql; do
    if [ -f "$sql_file" ] && [ "$(basename "$sql_file")" != "999_foreign_keys.sql" ]; then
        echo "Running root script: $sql_file"
        psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f "$sql_file"
    fi
done

# 2. Subdirectorios en orden de dependencia
MODULES=("organizations" "user" "academic" "elections" "ballots" "voting" "audit" "results")

for module in "${MODULES[@]}"; do
    if [ -d "$BASE_DIR/$module" ]; then
        echo "Running module: $module"
        for sql_file in "$BASE_DIR/$module"/*.sql; do
            if [ -f "$sql_file" ]; then
                echo "  -> Executing: $sql_file"
                psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f "$sql_file"
            fi
        done
    fi
done

# 3. Claves foráneas globales (se ejecutan al FINAL)
if [ -f "$BASE_DIR/999_foreign_keys.sql" ]; then
    echo "Running final foreign keys script..."
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f "$BASE_DIR/999_foreign_keys.sql"
fi

echo "Database migrations executed successfully."