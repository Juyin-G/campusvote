# Sistema Electoral API

## ⚠️ Security Notice

**IMPORTANT**: This application has been updated with enhanced database security measures. Please read the [Database Security Configuration](SECURITY-DATABASE.md) document before deploying.

Key security changes:
- Database port now binds to localhost only (127.0.0.1:5433)
- Separate superuser and application database accounts
- All passwords must be set via environment variables (no defaults)
- Application uses a non-superuser account with limited privileges

## Configuración Inicial
1. Clonar el repositorio.
2. Copiar `.env.example` a `.env` y configurar las variables (DATABASE_URL, JWT_SECRET).
   - **IMPORTANTE**: JWT_SECRET es obligatorio en TODOS los entornos (desarrollo, pruebas, producción).
   - Debe tener al menos 32 caracteres y ser criptográficamente seguro.
   - Genere uno único con: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
   - NUNCA use valores predeterminados o de ejemplo en producción.
3. Instalar dependencias: `npm install`.
4. Levantar base de datos (PostgreSQL 15+ recomendado).
5. Ejecutar migraciones y seeds: `npm run db:setup && npm run db:seed`.
6. Iniciar servidor: `npm run dev`.

## Requisitos de Seguridad
- **JWT_SECRET**: Obligatorio en todos los entornos, mínimo 32 caracteres, criptográficamente seguro.
- La aplicación NO arrancará si JWT_SECRET no está configurado o usa un valor inseguro conocido.
- Para pruebas automatizadas, configure JWT_SECRET en el entorno de CI/CD con un valor seguro.

## Documentación
Una vez corriendo el servidor, visita: `http://localhost:3000/api/docs`

## Arquitectura de Carpetas
- `src/modules/`: Feature-based (auth, users, elections).
- `src/common/`: Errores tipados, utilidades compartidas.
- `src/middlewares/`: Autenticación, validación Zod, RBAC.
- `database/sql/`: Scripts nativos de PostgreSQL (Triggers, Funciones).