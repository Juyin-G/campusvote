# Sistema Electoral API

## Configuración Inicial
1. Clonar el repositorio.
2. Copiar `.env.example` a `.env` y configurar las variables (DATABASE_URL, JWT_SECRET).
3. Instalar dependencias: `npm install`.
4. Levantar base de datos (PostgreSQL 15+ recomendado).
5. Ejecutar migraciones y seeds: `npm run db:setup && npm run db:seed`.
6. Iniciar servidor: `npm run dev`.

## Documentación
Una vez corriendo el servidor, visita: `http://localhost:3000/api/docs`

## Arquitectura de Carpetas
- `src/modules/`: Feature-based (auth, users, elections).
- `src/common/`: Errores tipados, utilidades compartidas.
- `src/middlewares/`: Autenticación, validación Zod, RBAC.
- `database/sql/`: Scripts nativos de PostgreSQL (Triggers, Funciones).