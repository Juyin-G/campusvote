# CAMPUSVOTE — Documentación Técnica del Backend (JavaScript)

> **Propósito:** Describir de forma fiel y completa cómo funciona el backend real de **CampusVote** (Node.js + Express + Prisma + PostgreSQL). Es la **spec de referencia** para el desarrollo del frontend (Flutter/Web).

---

## 1. Stack Tecnológico

| Componente | Tecnología |
|---|---|
| Lenguaje / Runtime | Node.js ≥ 20.9 (ESM) |
| Framework | Express 5 |
| ORM | Prisma 6 (`@prisma/client`) |
| Base de datos | PostgreSQL |
| Autenticación | JWT HS256 (`jsonwebtoken`) + 2FA TOTP (`otplib`) + QR |
| Login social | Google OAuth (fetch nativo, sin dependencia) |
| Validación | Zod 4 |
| Documentación API | Swagger (`swagger-jsdoc` + `swagger-ui-express`) |
| Colas/notificaciones | Workers + tabla `notification_deliveries` |
| Tests | Jest + Supertest (integración) |
| Lint | ESLint (+ plugins security, sonarjs) |

---

## 2. Roles y Modelo Jerárquico

**Roles (`src/constants/roles.js`):** `STUDENT`, `TEACHER`, `ADMIN`, `ELECTORAL_COMMISSION`, `JURY`, `SUPERADMIN`.

- **SUPERADMIN** (`juan.ochoa@tecsup.edu.pe`) — superusuario global. **Oculto** en listados (`user.repository.js buildWhere`). Sin carrera/ciclo. Creado solo por **seed**.
- **ADMIN** — administra la organización: crea jurados (bulk), asigna carrera/ciclo, abre ferias/concursos.
- **JURY** — califica proyectos de ferias/concursos con estrellas (1-5) + comentario.
- **Docente (TEACHER)** y **Estudiante (STUDENT)** — participan como público en ferias y concursos; votación de profesores.

---

## 3. Resolución de Organización por Dominio

`Organization.allowed_email_domains` (JSONB) define los dominios válidos. En `register` (`auth.service.js`), el dominio del email se resuelve automáticamente a la organización vía SQL `@>` (JSONB). El estudiante se registra **solo con código + email + identidad**; el **ADMIN asigna la carrera** post-registro y el **ciclo se auto-calculan por periodo de ingreso**.

**Carrera por código corto:** el código institucional trae la carrera y el ciclo (se parsean). Ej: `C-24` → carrera `Diseño y Desarrollo de Software`, ciclo se extrae del código. Util: `src/shared/utils/careerParse.js` (`matchCareerFromCode` prefijo más largo, `extractCycleFromCode`). Tabla `careers` (org-scoped, code/name/cycle/isActive), `User.careerId`.

---

## 4. Módulos Principales

### 4.1 Superadministración y Provisionamiento
- **`POST /users/admin/provision`** (solo SUPERADMIN): crea organización + ADMIN con OTP/QR en un solo paso.
- **`POST /users/bulk`** (ADMIN/ELECTORAL_COMMISSION/SUPERADMIN): alta masiva de **jurados** (y otros).

### 4.2 Autenticación
- **`POST /auth/login`** — JWT + TOTP obligatorio.
- **`/auth/google`**, **`/auth/google/callback`**, **`/auth/google/verify`** — Google OAuth (requiere `GOOGLE_CLIENT_ID/SECRET/CALLBACK_URL`; devuelve `GOOGLE_NOT_CONFIGURED` si no hay config).

### 4.3 Rating por Estrellas (Ferias/Concursos) ⭐ — **NUEVO**
Endpoints montados en la raíz (patrón de `results.routes.js`), bajo `/elections/:id/ratings`:

| Método | Ruta | Descripción | Roles |
|---|---|---|---|
| POST | `/elections/:id/ratings/:candidacyId` | Calificar (score 1-5 + comment) un proyecto | JURY, ADMIN, ELECTORAL_COMMISSION, SUPERADMIN |
| GET | `/elections/:id/ratings/results` | Promedio de estrellas por proyecto (con distribución 1..5) | JURY, ADMIN, EC, SUPERADMIN, TEACHER, STUDENT |
| GET | `/elections/:id/ratings` | Listar calificaciones **trazables** | VIEWERS |

- **Modelo `Rating`** (`prisma/schema/rating.prisma`): `score SmallInt (1..5)`, `comment`, `@@unique([candidacyId, jurorId])` (un jurado califica una vez; upsert), relation `"JurorRatings"`.
- **SQL:** `database/sql/ratings/001_ratings.sql` → tabla `ratings` + enum `rating_status` (ACTIVE/REVOKED).
- **Elegibilidad:** solo procesos `FAIR` / `AWARD` / `EVENT_POLL`, estado `OPEN`, anti-IDOR por organización (`findElectionOwnerOrganization`).
- **Notificación al expositor:** al calificar, se envía `RATING_RECEIVED` al dueño del proyecto (`rating.service.js rateProject`).
- **Integración con concurso:** el `election_process_type` acepta `EVENT_POLL` y `AWARD` (extensiones idempotentes en `elections/001_enums.sql`).

### 4.4 Notificaciones (Flutter) — **NUEVOS tipos**
Enum `NotificationType` extendido con **`FAIR_OPENED`** (la feria abrió → jurados pueden calificar) y **`RATING_RECEIVED`** (un jurado calificó tu proyecto). Extensiones idempotentes en `notifications/001_notifications.sql`.

API: `GET /notifications`, `GET /notifications/unread-count`, `PATCH /notifications/:id`, `POST /notifications/mark-all-read`. Delivers por canal `IN_APP`/`EMAIL`/`PUSH` vía workers (`notification_deliveries`).

### 4.5 Proceso Electoral / Resultados / Votación
- Elecciones, candidaturas, listas, papeletas, votación, tally, certificación, publicación, reportes PDF y exportación CSV/XLSX.
- Resultados: `GET /results/live?election_id=...`, `GET /results/final?election_id=...`.

### 4.6 Auditoría
Registro de acciones con trazabilidad (quién/quién/ip/headers) en `audits`.

---

## 5. Base de Datos — Esquema y Comandos

**Dev:** `campusvote_db` en `localhost:5433`, user `postgres`/`postgres`.

### Reconstruir esquema desde cero (dev)
```sql
DROP SCHEMA public CASCADE; CREATE SCHEMA public;
```
Luego:
```bash
npm run db:migrate   # node scripts/apply-sql.js (orden canónico de database/sql/** )
npm run db:seed      # npx tsx prisma/seed.ts
```

> **Nota:** `apply-sql.js` **no es idempotente** sobre una BD legacy existente (falla p. ej. en `user/003_users_indexes.sql`). Requiere esquema limpio (`DROP SCHEMA`).

### Seed
`prisma/seed.ts` → `database/seeds/user.ts` crea **solo el SUPERADMIN** (idempotente via `upsert`):
- `juan.ochoa@tecsup.edu.pe` / `SUPERADMIN` / contraseña desde `SEED_SUPERADMIN_PASSWORD` (fallback `Password123!`), `institutionalId: 'C-24'`, `isSuperuser: true`.

Para poblarlo con la organización + cuentas demo (pendiente: datos reales de compañeros), se ampliará `database/seeds/` con la creación de la org, un ADMIN y los jurados.

---

## 6. Migraciones SQL recientes

| Archivo | Contenido |
|---|---|
| `database/sql/ratings/001_ratings.sql` | tabla `ratings` + enum `rating_status` |
| `database/sql/academic/009_careers.sql` | tabla `careers` (código corto, org-scoped) |
| `database/sql/elections/001_enums.sql` | `election_process_type` + `EVENT_POLL`/`AWARD` (idempotente) |
| `database/sql/notifications/001_notifications.sql` | `notification_type` + `FAIR_OPENED`/`RATING_RECEIVED` (idempotente) |
| `database/sql/user/002_users_table.sql` | constraints relajados (STUDENT sin program_id obligatorio; ciclo opcional) |
| `database/sql/organizations/002_organizations.sql` | `allowed_email_domains` JSONB |

---

## 7. Estado de Verificación

- **Tests:** 502/502 pasan (46 suites) + **lint limpio**.
- **DB dev:** esquema aplicado (incluye `ratings`, `careers`, enums extendidos). Seed de superadmin aplicado.
- **Pendiente:** datos reales de compañeros para el seed; TOTP/Google OAuth E2E (requiere credenciales reales).

---

## 8. Roadmap / Siguientes pasos
1. Completar seed con cuentas reales (ADMIN de org + jurados).
2. Frontend (Flutter): pantallas de ferias, calificación por estrellas, notificaciones `FAIR_OPENED`/`RATING_RECEIVED`, subida de **banners/imágenes de proyectos**.
3. Endpoints públicos de ferias + galería de imágenes.
