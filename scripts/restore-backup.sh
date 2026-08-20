# #!/bin/bash
# # Uso: ./restore-backup.sh backup_2026-08-20.sql

# BACKUP_FILE=$1
# pg_restore -h localhost -U postgres -d electoral_prod -v "$BACKUP_FILE"