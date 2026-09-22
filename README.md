# Sistema Electoral API

## Security Notice

**IMPORTANT**: This application has been updated with enhanced database security measures. Please read the [Database Security Configuration](SECURITY-DATABASE.md) document before deploying.

Key security changes:
- Database port now binds to localhost only (127.0.0.1:5433)
- Separate superuser and application database accounts
- All passwords must be set via environment variables (no defaults)
- Application uses a non-superuser account with limited privileges

## Configuración Inicial

### 1. Clonar el repositorio
```bash
git clone <repository-url>
cd campusvote
```

### 2. Configurar variables de entorno

**CRITICAL**: Set strong database passwords before starting the database.

```bash
# Copy the example environment file
cp .env.example .env

# Generate strong random passwords (Linux/Mac)
openssl rand -base64 32  # Use for POSTGRES_SUPERUSER_PASSWORD
openssl rand -base64 32  # Use for POSTGRES_APP_PASSWORD

# Or on Windows PowerShell:
# [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
```

Edit `.env` and set at minimum:
- `POSTGRES_SUPERUSER_PASSWORD` - Strong password for database superuser
- `POSTGRES_APP_PASSWORD` - Strong password for application user
- `JWT_SECRET` - Strong secret for JWT tokens
- Update `DATABASE_URL` with your `POSTGRES_APP_PASSWORD`
- Update `MIGRATION_DATABASE_URL` with your `POSTGRES_SUPERUSER_PASSWORD`

**Never commit your `.env` file to source control!**

### 3. Instalar dependencias
```bash
npm install
```

### 4. Levantar base de datos
```bash
# Start PostgreSQL in Docker (requires passwords to be set in .env)
npm run db:up

# Wait for the database to be ready (check with docker ps)
docker ps
```

### 5. Ejecutar migraciones
```bash
# Run migrations using the superuser account
npm run db:setup
```

### 6. Iniciar servidor
```bash
# Start the development server (uses application account)
npm run dev
```

## Database Security

The application now uses two separate database accounts:

1. **Superuser Account** (`postgres` by default)
   - Used ONLY for migrations and administrative tasks
   - Has full database privileges
   - Should NEVER be used by the application at runtime

2. **Application Account** (`campusvote_app` by default)
   - Used by the application for all runtime operations
   - Has limited privileges (SELECT, INSERT, UPDATE, DELETE only)
   - Cannot modify schema or create/drop tables

For detailed security information, see [SECURITY-DATABASE.md](SECURITY-DATABASE.md).

## Production Deployment

**DO NOT use the example passwords in production!**

For production deployments:
1. Use a secrets management solution (AWS Secrets Manager, HashiCorp Vault, etc.)
2. Generate strong, unique passwords for each environment
3. Consider removing the `ports` section from docker-compose.yml and using Docker networks
4. Enable SSL/TLS for database connections
5. Implement network segmentation and firewall rules
6. Enable database audit logging
7. Regular security updates and monitoring

See [SECURITY-DATABASE.md](SECURITY-DATABASE.md) for a complete production security checklist.

## Documentación
Una vez corriendo el servidor, visita: `http://localhost:3000/api/docs`

Documentos de flujo y revisión:
- [Revisión de producción F0-F9](docs/REVISION_PRODUCCION_F0_F9.md)
- [Flujo administrativo y panel público](docs/FLUJO_ADMINISTRATIVO_Y_PANEL_PUBLICO.md)
- [Flujo Flutter, jurado y votación](docs/FLUJO_FLUTTER_JURADO_VOTACION.md)
- [Auditoría completa de producción](docs/AUDITORIA_COMPLETA_PRODUCCION.md)
- [Despliegue en Render](docs/DEPLOY_RENDER_STAGING_Y_PRODUCCION.md)
- [Plan del frontend administrativo web](docs/PLAN_FRONTEND_ADMIN_WEB.md)
- [Piloto staging de 100 personas y configuración opcional de Google](docs/DEPLOY_RENDER_STAGING_Y_PRODUCCION.md)
- [Guía Firebase Web, Flutter e iOS](docs/GUIA_FIREBASE_WEB_FLUTTER_IOS.md)
- [Variables públicas del frontend](.env.frontend.example)

## Arquitectura de Carpetas
- `src/modules/`: Feature-based (auth, users, fairs, academic, audit).
- `src/common/`: Errores tipados, utilidades compartidas.
- `src/middlewares/`: Autenticación, validación Zod, RBAC.
- `database/sql/`: Scripts nativos de PostgreSQL (Triggers, Funciones).