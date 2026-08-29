# CampusVote — Guía de Comandos y Flujo de Trabajo

Sistema de Votación Universitaria (Node.js + Express + PostgreSQL + Prisma).

Flujo de trabajo estándar para desarrollo local:

```
npm run db:up       # 1. Levantar PostgreSQL (Docker)
npm run db:setup    # 2. Aplicar migraciones SQL (tablas, enums, funciones)
npm run db:generate # 3. Generar el cliente Prisma (modelos PascalCase/camelCase)
npm run db:seed     # 4. (Opcional) Poblar datos de ejemplo
npm run dev         # 5. Iniciar el servidor en modo desarrollo
```

---

## 1. Requisitos previos

- **Node.js** ≥ 20 (v26 usado en pruebas)
- **Docker Desktop** / Docker Engine (para la base de datos PostgreSQL)
- **Git**

## 2. Configuración inicial (una sola vez)

```powershell
# 1. Instalar dependencias
npm install

# 2. Crear el archivo de entorno desde la plantilla
#    El .env NO se versiona (está en .gitignore); .env.example es la plantilla.
Copy-Item .env.example .env

# 3. Generar claves secretas e indicarlas en .env
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
#   Copiar el resultado a JWT_SECRET (y a JWT_REFRESH_SECRET si deseas uno distinto).
#   OBLIGATORIO: JWT_SECRET debe tener >= 32 caracteres (el servidor aborta si no).
```

Variables mínimas de `.env`:

| Variable | Descripción |
|---|---|
| `DATABASE_URL` | Conexión de la app a Postgres |
| `JWT_SECRET` | Clave de firma de tokens (≥32 caracteres) |
| `POSTGRES_SUPERUSER_PASSWORD` | Clave del usuario superusuario de la BD |
| `POSTGRES_APP_PASSWORD` | Clave del usuario de la aplicación |
| `CORS_ORIGIN` | Origen permitido del frontend (por defecto `http://localhost:5173`) |
| `SMTP_HOST/`USER/`PASS/`FROM` | Configuración de correo (Mailtrap en dev) |

> ⚠️ **Seguridad:** Nunca uses los passwords de ejemplo de `.env.example` en producción.
> El módulo `src/config/env.js` valida la fortaleza de `JWT_SECRET` al arrancar.

## 3. Base de datos

| Comando | Qué hace |
|---|---|
| `npm run db:up` | Levanta el contenedor PostgreSQL (bind a `127.0.0.1:5433`) |
| `npm run db:setup` | Ejecuta en orden los scripts SQL de `database/sql/**` (crea tablas, enums, funciones, índices, vistas) |
| `npm run db:generate` | Regenera el cliente Prisma desde `prisma/schema` |
| `npm run db:seed` | Puebla datos de ejemplo |

**Reinicio limpio (desde cero):**

```powershell
docker compose down -v          # elimina contenedor y volumen (¡borra datos!)
npm run db:up
npm run db:setup
npm run db:generate
```

> 💡 No uses `docker compose down -v` si quieres conservar los datos de la BD.

**Nota sobre la estructura de datos:** el schema vive en `prisma/schema/*.prisma`
(modelos en **PascalCase**, campos en **camelCase**). Las tablas físicas se definen
en `database/sql/**` y se mapean con `@@map` / `@map`. `npm run db:setup` crea la
estructura SQL; `prisma generate` crea el cliente que el código usa.

## 4. Desarrollo

| Comando | Qué hace |
|---|---|
| `npm run dev` | Inicia el servidor con `nodemon` (recarga automática) |
| `npm run start` | Inicia el servidor en producción (sin recarga) |

- El servidor escucha en el puerto indicado por `PORT` (por defecto `3000`).
- **Swagger / docs:** `http://localhost:3000/api-docs`
- **Health check:** `GET http://localhost:3000/health`
- **Endpoints:** prefijo `/api` (p. ej. `POST /api/auth/login`)

## 5. Verificación de calidad

| Comando | Qué hace |
|---|---|
| `npm run lint` | ESLint sobre todo el proyecto |
| `npx prisma validate` | Valida el schema Prisma |
| `npm run test` | Ejecuta `db:setup` + toda la suite de tests (Jest) |
| `npm run test:watch` | Tests en modo watch |
| `npm run test:email` | Envía un correo de prueba vía SMTP |

Para ejecutar **un solo archivo** de tests:

```powershell
node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js tests/unit/users
```

## 6. Flujo de trabajo recomendado (git)

```powershell
git checkout -b feature/<nombre>   # rama de trabajo
# ... cambios ...
npm run lint                       # pasar lint
npm run db:up && npm run db:setup  # base actualizada
npm run dev                        # probar manualmente en :3000/api-docs
git add .
git commit -m "feat: ..."
```

---

## 7. Solución de problemas comunes

| Problema | Solución |
|---|---|
| `error: .env no encontrado` / server aborta con "JWT_SECRET" | Crear `.env` desde `.env.example` y definir `JWT_SECRET` (≥32 chars) |
| `ECONNREFUSED` a `localhost:5433` | `npm run db:up` (Docker debe estar corriendo) |
| `P2010` / "start_voting_session does not exist" | Falta ejecutar `npm run db:setup` (no se crearon las funciones SQL) |
| El cliente Prisma no tiene un modelo nuevo | `npm run db:generate` |
| Tests fallan por conexión de BD | Verificar `db:up` y `DATABASE_URL` |
| Puerto 3000 ocupado | `PORT=3001 npm run dev` |
