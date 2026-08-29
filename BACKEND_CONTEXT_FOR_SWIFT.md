# BACKEND CONTEXT FOR SWIFT — CAMPUSVOTE

> **Propósito de este documento:** describir el backend existente de CampusVote tal como está implementado hoy, para servir de contexto a una aplicación móvil Swift.
>
> Este documento representa el backend **REAL**. No inventa endpoints, modelos, respuestas ni flujos. Cuando un comportamiento no pudo confirmarse, se indica `NO CONFIRMADO`. Cuando una funcionalidad está rota, se indica `ESTADO ACTUAL: ROTO`.
>
> **Fuentes:** código real (`src/`), SQL real (`database/sql/`), Prisma real (`prisma/schema/`), routes reales, schemas reales (Zod/Joi), controllers/services/repositories reales, y dos auditorías de validación previas.

---

# 1. INFORMACIÓN GENERAL

## Propósito del backend

CampusVote es un sistema de votación universitaria. El backend expone una API RESTful que gestiona:

- Autenticación y usuarios (registro, login, 2FA/TOTP, recuperación de contraseña, verificación de email).
- Organizaciones y solicitudes de alta institucional.
- Dominio académico (facultades, programas, periodos, padrón electoral).
- Procesos electorales (elecciones, cargos, listas de candidatos, candidaturas, cédulas de votación).
- Votación (sesiones de votación, emisión de voto cifrado, integridad).
- Resultados (escrutinio/`tally`, certificación, publicación, reportes PDF y exportación CSV/XLSX).
- Auditoría (logs encadenados por hash) y tokens de acceso de un solo uso.
- Notificaciones y traducciones de plataforma (i18n).

## Stack tecnológico

| Componente | Tecnología |
|---|---|
| Runtime | Node.js (proyecto ESM — `import/export`) |
| Framework HTTP | Express |
| ORM | Prisma |
| Base de datos | PostgreSQL 16 (Docker) |
| Validación | Zod (mayoría de módulos), Joi (módulo audit) |
| Autenticación | JWT (HS256) + bcrypt + TOTP |
| Documentación | Swagger/OpenAPI (`swagger-ui-express`) |

## Estructura modular

```
src/
  app.js                    # bootstrap Express (helmet, compression, rate-limit, rutas)
  routes/index.js           # montaje de todos los routers bajo /api
  middlewares/              # auth, validate, rateLimiter, errorHandler, notFoundHandler
  shared/                   # utils (apiResponse, formatUserResponse), errors (ApiError)
  config/                   # env, logger, cors, swagger
  constants/                # roles, httpStatus, messages
  modules/
    auth/                   # login, register, 2FA/TOTP, password reset, email verify, refresh tokens
    users/                  # gestión de usuarios y roles
    organizations/          # organizaciones y solicitudes
    academic/               # facultades, programas, periodos, padrón (voter-registries)
    elections/              # elecciones, positions, candidate-lists, candidacies, election-rules
    ballots/                # cédulas (ballots), ballot-positions, ballot-options
    voting/                 # sesiones de votación y emisión de voto
    results/                # tally, certificación, publicación, reporte, exportación
    audit/                  # logs de auditoría y voting-access-tokens
    notification/           # notificaciones in-app
    PlatformTranslation/    # i18n / traducciones
    health/                 # health checks
prisma/schema/              # modelos Prisma por dominio
database/sql/               # migraciones SQL (funciones, enums, triggers, constraints)
tests/                      # tests (unit + integración) y setup de BD
scripts/db-setup.ps1        # script PowerShell de migraciones (desfasado — ver §16)
```

Módulos eliminados de versiones anteriores (no existen actualmente en `src/routes/index.js`): `voter_registry` (reemplazado por `academic/voter-registry`), `organization-request` como módulo de rutas propio (integrado en `organization.routes.js`), `health.docs/service` (health quedó con controlador).

---

# 2. ARQUITECTURA

## Flujo general

```text
HTTP Request
    ↓
Routes (Express Router)
    ↓
Middleware (authenticate / authorize / validate / rate limiter)
    ↓
Controller (capa HTTP: lee req, responde res.json)
    ↓
Service (lógica de negocio, reglas, mensajes de error)
    ↓
Repository (acceso a datos)
    ↓
Prisma / SQL nativo (funciones PL/pgSQL)
    ↓
PostgreSQL
```

## Módulos que siguen este patrón

Prácticamente todos los módulos implementan **Routes → Middleware → Validation → Controller → Service → Repository**. Ejemplos confirmados: `auth`, `users`, `elections`, `candidacy`, `ballots`, `voting`, `results`, `academic`.

## Excepciones al patrón

1. **`organization.routes.js`**: los endpoints de aprobación (`/requests/:id/approve` y `/requests/:id/reject`) manejan la lógica directamente dentro del archivo de rutas (razones de negocio inline), apoyándose en `approval.service.js`. No hay un `request.controller.js` separado montado.
2. **`PlatformTranslation`**: es un módulo menor con rutas simples que llaman a servicios/controladores de forma directa.
3. **`audit`**: los tokens de un solo uso (`/audit/tokens/*`) usan validación **Joi** (no Zod) y endpoints sin autenticación (ver §5).
4. **Repositorios con SQL crudo**: `auth.repository.js`, `voting.repository.js`, `election.repository.js`, `ballot.repository.js`, `results.repository.js` y `tally.repository.js` invocan funciones SQL nativas a través de `prisma.$queryRaw` / `$executeRaw` (no todas las consultas pasan por el motor de tipos de Prisma).

## Middleware de autenticación (resumen)

- `authenticate`: requiere `Authorization: Bearer <JWT>`; verifica con HS256 contra `JWT_SECRET`; rechaza tokens con `purpose='TOTP_PENDING'` en rutas normales; popula `req.user` con el payload decodificado.
- `authorize(...roles)`: comprueba `req.user.role` contra la lista permitida. Devuelve 403 si no coincide.
- `validate(schema)`: ejecuta `schema.safeParse({body, query, params})`; ante fallo produce 400 con `details: [{field, message}]` (no adjunta el resultado validado a `req`).

---

# 3. AUTENTICACIÓN

## Base URL

Todos los endpoints bajo `/api`. Toda respuesta lleva el prefijo base de la URL montada: `http://<host>:<port>/api/...`.

En `src/app.js` hay un **rate limit global** de `100 peticiones / 15 minutos / IP` sobre `/api` (aplica a TODAS las peticiones de la API antes de cualquier otra lógica).

## Register

- **Endpoint:** `POST /api/auth/register`
- **Método:** POST
- **Auth:** público (limitador `authLimiter` = 10/60min/IP)
- **Request (body):**
  ```json
  {
    "username": "juan.perez",
    "email": "juan.perez@university.edu.pe",
    "password": "Contraseña1",
    "firstName": "Juan",
    "lastName": "Perez",
    "institutionalId": "2020123456",
    "organizationId": "<uuid opcional>",
    "facultyId": "<uuid, requerido si role=TEACHER>",
    "programId": "<uuid, requerido si role=STUDENT>",
    "currentCycle": 5,
    "admissionPeriodId": "<uuid opcional>",
    "specialty": "...",
    "department": "..."
  }
  ```
- **Validaciones (auth.schema.js `registerSchema`):**
  - `username`: 3–50, regex `^[a-zA-Z0-9._-]+$`.
  - `email`: email válido; para STUDENT/TEACHER debe cumplir `^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.(edu\.pe|edu)$`.
  - `password`: mínimo 8, con mayúscula, minúscula y dígito.
  - `firstName`/`lastName`: obligatorios (1–150).
  - `institutionalId`: obligatorio.
  - `role`: enum `[STUDENT, TEACHER, ADMIN, ELECTORAL_COMMISSION, OBSERVER]`, default `STUDENT`. **PERO el servicio (`auth.service.js`) fuerza siempre `role = 'STUDENT'`**, ignorando el valor enviado por el cliente.
  - `programId` obligatorio si role=STUDENT; `facultyId` obligatorio si role=TEACHER (regla irrelevante en la práctica, ya que el service fuerza STUDENT).
- **Flujo del servicio:** verifica email/username duplicados (409), hashea con bcrypt (12 rounds), crea el usuario con `authProvider='LOCAL'` y `mustChangePassword=false`, genera un token de verificación de email vía SQL (24h de expiración, máx. 5/hora), envía el correo de verificación.
- **Respuesta 201:**
  ```json
  {
    "success": true,
    "message": "La cuenta fue creada, pero no se pudo enviar el correo de verificación. Solicite el reenvío para activarla.",
    "data": {
      "user": {
        "id": "<uuid>", "username": "juan.perez", "email": "juan.perez@university.edu.pe",
        "role": "STUDENT", "status": "PENDING", "date_joined": "<ISO>"
      }
    },
    "meta": { "timestamp": "<ISO>", "requestId": "<uuid>" }
  }
  ```
- **Errores:** 400 (validación, `BAD_REQUEST` con `details` por campo) · 409 (`CONFLICT`: email/identificador o username duplicado) · 503 (`REGISTER_EMAIL_FAILED` si falla el envío del correo) · 429 (`authLimiter`).
- **ESTADO ACTUAL:** el mensaje de respuesta es **siempre** el de "no se pudo enviar el correo", incluso cuando el correo sí se envió. El controller consulta `result.verificationEmailSent`, campo que el servicio **no devuelve** (`auth.service.js` retorna solo `{ user }`).

## Login

- **Endpoint:** `POST /api/auth/login`
- **Método:** POST
- **Auth:** público (limitador `loginLimiter` = **5/15min/IP**)
- **Request (body):**
  ```json
  { "email": "juan.perez@university.edu.pe", "password": "Contraseña1" }
  ```
- **Validaciones:** `email` válido (trim+lowercase), `password` mínimo 1 (no empty).
- **Flujo del servicio:** usuario no existe o `authProvider !== 'LOCAL'` → compara contra un hash dummy (anti-enumeración por timing) + 401. Llama `loginIsAllowed()` (SQL `login_is_allowed`); si no → **423** `ACCOUNT_LOCKED`. Contraseña incorrecta → `register_failed_login()` (bloqueo tras ≥5 intentos por 15 min vía SQL) + 401. `!isVerified` → **403** (debe verificar email). Si `twoFactorEnabled` → emite **token temporal** TOTP (5 min) y responde `requiresTotp:true`. Sin 2FA → `register_successful_login()` + emite **access JWT**.
- **Respuesta con 2FA (200):**
  ```json
  {
    "success": true,
    "message": "Se requiere autenticación de dos factores (2FA) para continuar.",
    "data": { "requiresTotp": true, "tempToken": "<JWT 5min>", "mustChangePassword": false },
    "meta": { "timestamp": "<ISO>", "requestId": "<uuid>" }
  }
  ```
- **Respuesta sin 2FA (200):**
  ```json
  {
    "success": true,
    "message": "Inicio de sesión exitoso.",
    "data": {
      "requiresTotp": false,
      "token": "<access JWT>",
      "mustChangePassword": false,
      "user": { "<formatUserResponse — ver §13>" }
    },
    "meta": { "timestamp": "<ISO>", "requestId": "<uuid>" }
  }
  ```
- **Errores:** 400 · 401 (`UNAUTHORIZED`, mensaje genérico `LOGIN_FAILED`) · 403 (`FORBIDDEN`, email no verificado) · **423** (`ACCOUNT_LOCKED`, con placeholder literal `{minutes}` sin sustituir en algunos mensajes) · 429.
- **ESTADO ACTUAL:** el login depende de funciones SQL (`login_is_allowed`, `register_failed_login`, `register_successful_login`) que **no se cargan en una instalación limpia** por el defecto V6 (ver §16). En consecuencia, el login real falla en instalaciones vía `scripts/db-setup.ps1` o `tests/setup-db.js`.

## Logout

- **Endpoint:** `POST /api/auth/logout`
- **Método:** POST
- **Auth:** `authenticate` (JWT completo)
- **Comportamiento real:** el controller lee `req.tokenHash || null`, campo que **ningún middleware establece** (solo establece `req.user`). Por tanto la rama `revokeRefreshToken(tokenHash)` es código muerto; siempre se ejecuta la rama `userId` → `revokeAllUserRefreshTokens(userId)`, que borra **todas** las sesiones de refresh del usuario.
- **Respuesta 200:** `data: { "loggedOut": true }`.
- **NOTA:** como la infraestructura de refresh tokens no emite tokens (V9, ver §16), esta revocación no tiene efecto práctico sobre el JWT de acceso (el access token sigue siendo válido hasta su expiración; el logout no los invalida a nivel de servidor).

## JWT

- **Algoritmo:** HS256 (fijado explícitamente en `auth.middleware.js` al verificar).
- **Payload del access token (`generateJwt`, auth.helpers.js):**
  ```json
  {
    "userId": "<uuid>",
    "email": "...",
    "role": "STUDENT",
    "organizationId": "<uuid>|null",
    "isSuperuser": false,
    "isStaff": false
  }
  ```
- **Expiración efectiva:** `JWT_EXPIRES_IN=24h` (confirmado en `.env` y `config/env.js`). El default `'15m'` del helper es inalcanzable porque `env.js` siempre define el valor.
  > **IMPORTANTE:** la expiración efectiva es **24 horas**. No usar 15 minutos.
- **Token temporal TOTP:** expiración fija `5m`, payload `{ userId, email, purpose: 'TOTP_PENDING' }`.
- **Middleware de validación (`authenticate`):**
  - Requiere header `Authorization: Bearer <token>`; ausente → 401.
  - Verifica con `jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] })`.
  - Token expirado → 401 `INVALID_TOKEN`.
  - Token inválido/malformado → 401 `INVALID_TOKEN`.
  - Token con `purpose='TOTP_PENDING'` en ruta normal → 403.
  - `authenticateAllowPending` permite `TOTP_PENDING` (solo en rutas de verificación TOTP); `requireTotpPending` exige `purpose='TOTP_PENDING'`.
- **Comportamiento del rol:** el rol se lee **del payload del JWT** (`req.user.role`) en `authorize`. No se consulta la BD por cada petición ni se valida contra una versión/`jti`. Por tanto, un cambio de rol en la BD **no invalida el token vigente** (V8, ver §16).

---

# 4. AUTORIZACIÓN

## Roles definidos (`src/constants/roles.js`)

- `STUDENT`
- `TEACHER`
- `ADMIN`
- `ELECTORAL_COMMISSION`
- `OBSERVER`

`GESTORES = [ADMIN, ELECTORAL_COMMISSION]` es el grupo usado para gestión electoral (elecciones, candidaturas, resultados, auditoría, padrón).

> No existe un rol `SIS`. "SIS" es el **sistema externo** que alimenta el padrón vía el procedimiento `sync-sis`, no un rol autenticado.

## Middleware

- **`authenticate`** (`src/middlewares/auth.middleware.js`): verifica presencia y validez del Bearer JWT. Puebla `req.user`.
- **`authorize(...roles)`**: comprueba `req.user.role` (del JWT) contra la lista. 403 si no coincide.
- El rol se verifica **desde el JWT**, no desde la base de datos en cada request (ver §3 JWT).

## Acceso por dominio (resumen)

| Dominio | Acceso |
|---|---|
| `/api/auth/*` | públicos + endpoints protegidos (logout, me, totp) |
| `/api/users` | list/create/update/role/status/unlock = ADMIN; `/me` y `GET /:id` cualquier autenticado (con anti-IDOR en `GET /:id`) |
| `/api/organizations/*` | management y requests = ADMIN; `GET /` y `GET /:id` públicos (via `optionalAuthenticate` no-op) |
| `/api/academic/faculties`, `/programs`, `/periods` | **ADMIN** (guard a nivel de router) |
| `/api/academic/voter-registries` | **ADMIN + ELECTORAL_COMMISSION** |
| `/api/elections/*` | reads = autenticado; writes/gestion = GESTORES; `DELETE` = ADMIN |
| `/api/ballots/*` | reads = autenticado; writes = GESTORES |
| `/api/voting/*` | `authenticate` (cualquier rol autenticado); reglas de negocio en SQL/servicio |
| `/api/results` y `/api/elections/:id/certify|publish|tally` | gestión = GESTORES; `live`/`final` = autenticado (sin role check) |
| `/api/audit/logs` | ADMIN + ELECTORAL_COMMISSION |
| `/api/audit/tokens` | `POST /tokens` = autenticado; `POST /tokens/consume` y `GET /tokens/status` = **sin autenticación** (modelo de cabina) |
| `/api/notifications` | user propio = autenticado; create = ADMIN + ELECTORAL_COMMISSION |
| `/api/platform/translations` | `/dictionary` público; resto = ADMIN |

## Endpoints públicos (sin autenticación)

- `GET /health`, `GET /api/health`, `GET /api/health/db`
- `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/totp/login-verify`, `POST /api/auth/otp/verify-login` (con token TOTP pendiente)
- `POST /api/auth/password/forgot`, `POST /api/auth/password/reset`
- `POST /api/auth/verify-email`, `POST /api/auth/verify-email/resend`
- `POST /api/organizations/requests` (creación de solicitud de organización)
- `GET /api/organizations`, `GET /api/organizations/:id` (efectivamente públicos)
- `GET /api/platform/translations/dictionary`
- `POST /api/audit/tokens/consume`, `GET /api/audit/tokens/status`

---

# 5. OTP / TOTP / VERIFICACIÓN

## TOTP / 2FA

Parámetros (archivos de constantes/utilidades de OTP): código de **6 dígitos**, paso de **30 s**, tolerancia ±1 paso; códigos de respaldo: **10 por set**, **8 caracteres** del alfabeto `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, almacenados en SHA-256; se consumen al usarse.

Existen **dos conjuntos paralelos de rutas** con el mismo propósito: `/api/auth/totp/*` (schema `auth.schema.js`) y `/api/auth/otp/*` (schema `otp.schema.js`, con alias `token` y normalización de guiones/espacios). Ambos están activos.

| Endpoint | Método | Auth | Limitador | Request | Respuesta | Estado |
|---|---|---|---|---|---|---|
| `/api/auth/totp/setup` (y `/api/auth/otp/setup`) | POST | JWT | authLimiter | — | `data: { secret, uri, backupCodes: [10] }` | OK |
| `/api/auth/totp/verify` (y `/api/auth/otp/verify`) | POST | JWT | authLimiter | `{ code }` (exactamente 6 dígitos) | `data: { message, backupCodes: [10] }` | OK |
| `/api/auth/totp/disable` | POST | JWT | authLimiter | `{ password }` (opcional `code`, **no usado**) | `data: { message }` | OK (campo code ignorado) |
| `/api/auth/otp/disable` | POST | JWT | authLimiter | `{ password }` | `data: null` | OK |
| `/api/auth/totp/login-verify` | POST | token TOTP_PENDING | loginLimiter | `{ code }` o `{ backupCode }` | `data: { valid: true }` (backupCode añade `remainingCodes`) | OK — **no emite access token** |
| `/api/auth/otp/verify-login` | POST | token TOTP_PENDING | loginLimiter | `{ code }`/`{ token }`/`{ backupCode }` | igual que login-verify | OK |

### Flujo TOTP completo (login con 2FA)

1. `POST /api/auth/login` → si `twoFactorEnabled`, responde `{ requiresTotp: true, tempToken }`.
2. `POST /api/auth/totp/login-verify` (con `Authorization: Bearer <tempToken>` y `{ code }`) → `{ valid: true }`.
   - **NOTA:** este endpoint devuelve solo `{ valid: true }`; **no** devuelve access token ni objeto de usuario. Como está implementado, el cliente no puede completar la sesión; el `tempToken` es el único JWT emitido en el flujo 2FA. `NO CONFIRMADO` que exista un paso adicional que emita el access token tras la verificación 2FA.
3. Setup: `POST /api/auth/totp/setup` (genera secret + URI otpauth) → `POST /api/auth/totp/verify` (`{ code }`) → activa 2FA y genera 10 códigos de respaldo.
4. Disable: `POST /api/auth/totp/disable` (`{ password }`).

**Errores comunes:** 400 (`2FA no está activado`, `Código TOTP inválido`, `Primero debes iniciar la configuración de 2FA`) · 401/403 · 404 (usuario no encontrado en setup) · 409 (`2FA ya está activado` en setup) · 429.

## Verificación de email

| Endpoint | Método | Auth | Flujo | Respuesta | Estado |
|---|---|---|---|---|---|
| `POST /api/auth/verify-email` | POST | público (authLimiter) | `{ token }` → SQL `verify_email_with_token` (24h, activa `is_verified`, status PENDING→ACTIVE) | `data: { message }` | OK |
| `POST /api/auth/verify-email/resend` | POST | público (authLimiter) | `{ email }` → controller llama `authService.resendVerification` | — | **ESTADO ACTUAL: ROTO** — la función `resendVerification` **no existe/exporta** en `auth.service.js`; produce `TypeError` → **500** |

## Recuperación de contraseña

| Endpoint | Método | Auth | Flujo | Respuesta | Estado |
|---|---|---|---|---|---|
| `POST /api/auth/password/forgot` | POST | público (authLimiter) | `{ email }` → SQL `generate_password_reset_token` (ACTIVE + LOCAL, 1h, máx 5/hora, invalida anteriores); siempre responde igual (anti-enumeración) | `data: { message: "Si el correo existe..." }` | OK |
| `POST /api/auth/password/reset` | POST | público (authLimiter) | `{ token, newPassword }` → SQL `reset_password_with_token` (marca usado, resetea intentos/bloqueo, **revoca todos los refresh tokens del usuario**) | `data: { message }` | OK |

## Tokens de un solo uso (One-Time / Voting tokens)

Módulo `audit` — tabla `voting_access_tokens`, función SQL `consume_voting_access_token(p_raw_token, p_election_id)`.

| Endpoint | Método | Auth | Request | Respuesta | Estado |
|---|---|---|---|---|---|
| `POST /api/audit/tokens` | POST | `authenticate` (sin role check; el controller impide emitir para otro usuario salvo admin) | `{ userId, electionId, expiresAt }` (Joi) | (201) `{ success, data: { tokenRecord }, token, message }` — el `token` crudo es un **campo de nivel superior** (no dentro de `data`), se muestra una sola vez; errores 400/403/409 | OK (verificado en `audit.controller.js`) |
| `POST /api/audit/tokens/consume` | POST | **sin autenticación** (solo `tokenRateLimiter` 30/15min) | `{ rawToken, electionId }` | (200) `{ success, data: { consumed: true, message } }`; errores 404 (`no pertenece`), 409 (`ya utilizado`), 410 (`expirado`) | OK (modelo de cabina — **falta confirmar requisito de negocio**) |
| `GET /api/audit/tokens/status` | GET | **sin autenticación** (solo `tokenRateLimiter`) | `{ token, electionId }` (query) | (200) `{ success, data: status }`; 400/500 | OK (verificado en `audit.controller.js`) |
| `DELETE /api/audit/tokens/cleanup` | DELETE | `authenticate` + ADMIN (o `req.internal`) | — | (200) `{ success, data: result, message }`; 403/500 | OK (verificado en `audit.controller.js`) |

---

# 6. USUARIOS

## Endpoints (`/api/users`)

| Método | Ruta | Auth/Roles | Request | Respuesta `data` | Estado |
|---|---|---|---|---|---|
| GET | `/api/users/` | ADMIN, EC | query `page`, `limit`, `role`, `search` | array paginado (sendPaginated) | OK |
| GET | `/api/users/me` | autenticado | — | `formatUserResponse` (con `date_joined`) | OK |
| GET | `/api/users/:id` | autenticado (anti-IDOR: self-o-admin) | — | `formatUserResponse` | OK |
| POST | `/api/users/` | ADMIN | `{ username, email, password, first_name, last_name, institutional_id, role, organization_id }` | 201, `formatUserResponse` | OK |
| PUT | `/api/users/me` | autenticado | `{ first_name?, last_name? }` (≥1) | `formatUserResponse` | OK |
| PUT | `/api/users/:id` | ADMIN | `{ first_name?, last_name?, organization_id? }` (≥1) | `formatUserResponse` | OK |
| PATCH | `/api/users/:id/role` | ADMIN | `{ role }` (enum) | `formatUserResponse` | OK (no revoca JWT — V8) |
| PATCH | `/api/users/:id/status` | ADMIN | `{ is_active }` | `formatUserResponse` | OK |
| PATCH | `/api/users/:id/unlock` | ADMIN | — | `formatUserResponse` | OK |
| POST | `/api/users/me/password` | autenticado | `{ current_password, new_password }` | `{ changed: true }` | OK |

Roles disponibles: `STUDENT, TEACHER, ADMIN, ELECTORAL_COMMISSION, OBSERVER`.

## Datos enviados por el cliente vs. realmente verificados por el backend

- **En registro público** (`/api/auth/register`): el cliente **envía** `role`, `facultyId`, `programId`, `currentCycle`, `institutionalId`, etc. El backend **fuerza** `role='STUDENT'` (ignora el valor del cliente) y **no verifica** contra un servicio académico externo la autenticidad de `institutionalId`/`programId`/`facultyId`/`currentCycle` — son **autodeclarados**.
- **Sin embargo, para votar** (`can_user_vote`, SQL): la elegibilidad real la gobierna la tabla **`voter_registries`** (el padrón, gestionado por SIS/EC/ADMIN vía `/api/academic/voter-registries`), más requisitos `users.status='ACTIVE'`, `users.is_verified=TRUE`, `academic_periods.is_active=TRUE`. Por tanto, el voto **no** depende de los campos académicos autodeclarados.
- **En gestión administrativa** (`/api/users`): los datos (role, organización, etc.) sí son sets por ADMIN y persisten en BD.

**Resumen:** los campos académicos del perfil son autodeclarados y no validados externamente (V5), pero están **neutralizados para la votación** por el padrón `voter_registries`.

---

# 7. ORGANIZACIONES

## Endpoints (`/api/organizations`)

### Solicitudes (organization-request)

| Método | Ruta | Auth/Roles | Request | Respuesta `data` | Estado |
|---|---|---|---|---|---|
| POST | `/api/organizations/requests` | público | `{ institution_name, institution_type, country, estimated_members, contact_email?, contact_phone?, message? }` | la solicitud creada | OK |
| GET | `/api/organizations/requests` | ADMIN | query `page, limit, status` | paginado | OK |
| GET | `/api/organizations/requests/:id` | ADMIN | — | solicitud | OK |
| PATCH | `/api/organizations/requests/:id/approve` | ADMIN | — | organización creada | OK |
| PATCH | `/api/organizations/requests/:id/reject` | ADMIN | `{ rejection_reason }` | solicitud rechazada | OK |

### Organizaciones

| Método | Ruta | Auth/Roles | Request | Respuesta `data` | Estado |
|---|---|---|---|---|---|
| GET | `/api/organizations/` | público (optionalAuthenticate no-op) | query `page, limit, search, is_active, status, org_type` | paginado | OK |
| POST | `/api/organizations/` | ADMIN | `{ name, code, org_type?, logo?, primary_color?, secondary_color?, country?, timezone? }` | 201, organización | OK |
| GET | `/api/organizations/:id` | público | — | organización | OK |
| PATCH | `/api/organizations/:id` | ADMIN | `{ name?, code?, org_type?, logo?, primary_color?, secondary_color?, country?, timezone?, is_active?, onboarding_completed? }` | organización | OK |
| DELETE | `/api/organizations/:id` | ADMIN | — | `{ deleted: true }` | OK |
| PATCH | `/api/organizations/:id/onboarding` | ADMIN | — | organización | OK |
| POST | `/api/organizations/:id/onboarding/complete` | ADMIN | — | organización | OK |

`organizationTypeEnum` = `UNIVERSITY, INSTITUTE, SCHOOL, COMPANY, ASSOCIATION, OTHER`.

**Relaciones:** una `Organization` (`organizations`) tiene muchos `users`. Existe `organization_requests` (solicitudes) con estado `PENDING/APPROVED/REJECTED` y vínculo opcional a un revisor (usuario).

**Restricciones relevantes:** `code` único; `estimated_members` >0; color primario/seccundario en formato `#RRGGBB`.

---

# 8. PROCESOS ELECTORALES

## Elecciones (`/api/elections`)

| Método | Ruta | Auth/Roles | Request | Respuesta `data` | Estado |
|---|---|---|---|---|---|
| GET | `/api/elections` | autenticado | query `page, limit, status, scope_type, period_id, faculty_id, program_id, search` | paginado de elecciones | OK |
| GET | `/api/elections/:id` | autenticado | — | elección | OK |
| POST | `/api/elections` | GESTORES | `{ title, description?, process_type?, scope_type, period_id, faculty_id?, program_id?, start_at, end_at, form_structure?, is_anonymous_allowed? }` | 201, elección | OK |
| PATCH | `/api/elections/:id` | GESTORES | campos opcionales | elección | OK |
| DELETE | `/api/elections/:id` | **ADMIN** | — | `{ deleted: true }` | OK |
| PATCH | `/api/elections/:id/status` | GESTORES | `{ status }` | elección | Ver §V3 |

**Estados de elección (`election_status_type`):** `DRAFT, SCHEDULED, OPEN, CLOSED, CERTIFIED, PUBLISHED`.

**Transiciones permitidas (workflow):** `DRAFT→SCHEDULED→OPEN→CLOSED→CERTIFIED→PUBLISHED`; `PUBLISHED` es terminal. Transición a `SCHEDULED` exige ≥1 cargo y `end_at` futuro. Transición a `CERTIFIED` invoca la función SQL `certify_election()` — **ROTA** (V3).

**Campos de elección (camelCase):** `id, title, description, processType, scopeType, periodId, facultyId, programId, startAt, endAt, status, createdBy, formStructure, isAnonymousAllowed, createdAt, updatedAt`.

## Cargos / Posiciones (`/api/elections/:electionId/positions`)

- GET `/` (autenticado) · GET `/:id` (autenticado)
- POST `/` (GESTORES) `{ name, description?, seats? }`
- PATCH `/:id` (GESTORES) · DELETE `/:id` (GESTORES)
- `data` item: `id, electionId, name, description, seats, createdAt, updatedAt`.
- Requiere elección en `DRAFT`/`SCHEDULED` para escrituras. DELETE devuelve 409 si hay candidaturas asociadas.

## Listas de candidatos (`/api/elections/:electionId/candidate-lists`)

- GET `/`, GET `/:id` (autenticado)
- POST `/` (GESTORES) `{ name, acronym?, motto?, logo? }`
- PUT `/:id` y PATCH `/:id` (GESTORES, misma semántica) · DELETE `/:id` (GESTORES)
- `data` item: `id, electionId, name, acronym, motto, logo, createdAt, updatedAt`.

## Candidaturas (`/api/elections/:electionId/candidacies`)

- GET `/` (autenticado, query opcional `candidate_list_id`, `position_id`), GET `/:id` (autenticado)
- POST `/` (GESTORES) `{ candidate_list_id, user_id, position_id?, order_index?, is_principal? }`
- PUT `/:id` y PATCH `/:id` (GESTORES) `{ candidate_list_id?, position_id?, order_index?, is_principal? }` — **`status` y `user_id` NO editables**
- DELETE `/:id` (GESTORES)
- `data` item (formato **snake_case**, único entre los módulos electorales): `id, election_id, candidate_list_id, position_id, user_id, order_index, is_principal, status, created_at, updated_at, user: {id, username, first_name, last_name, institutional_id}|null`.
- **`status`** devuelve `PENDING` por defecto; los valores posibles en Prisma son `PENDING/APPROVED/REJECTED`. **ESTADO ACTUAL: ROTO** — ver V2 (tipo `candidacy_status_type` inexistente en BD → las tablas `candidacies` no se crean en instalación limpia).

## Reglas de elección (`/api/elections/:electionId/rules`)

Recurso singular (sin `/:id`).

- GET `/` (autenticado) · POST `/` (GESTORES, 409 si ya existen) · PATCH `/` (GESTORES) · DELETE `/` (GESTORES)
- Body (todos opcionales): `min_turnout_percentage`, `allow_blank_vote`, `allow_null_vote`, `max_votes_per_position`, `requires_2fa`.
- `data` (snake_case): `id, election_id, min_turnout_percentage, allow_blank_vote, allow_null_vote, max_votes_per_position, requires_2fa, created_at, updated_at`.

## Documentos de candidatura

Existe la tabla `CandidacyDocument` (`candidacy_documents`, tipo enum `candidacy_document_type`: `WORK_PLAN, CV, ID_CARD, OTHER`) en Prisma y en SQL (`007_candidacy_documents.sql`). **NO se encontró un endpoint HTTP dedicado para subir/documentar documentos de candidatura.** La creación de documentos de candidatura se referencia en `006_election_rules`/`007` SQL y en el modelo Prisma, pero no se confirmó una ruta REST activa.

## Mesas / Padrón electoral

Gestionado vía `/api/academic/voter-registries` (ver §6/§8). No hay un concepto "mesa" como recurso separado; la votación es por sesión de votación individual (ver §9).

## Votación

Ver §9.

## Resultados / Certificación / Publicación

Ver §10.

---

# 9. VOTACIÓN

Votación es crítica. Rutas en `/api/voting` (todos requieren `authenticate`; sin `authorize` — cualquier rol autenticado; las reglas las impone SQL + servicio).

## Endpoints

| Método | Ruta | Request | Respuesta `data` | Estado |
|---|---|---|---|---|
| POST | `/api/voting/elections/:electionId/sessions` | — | 201 `{ sessionId, electionId, status: "STARTED" }` | OK |
| POST | `/api/voting/sessions/:sessionId/cast` | `{ encryptedPayload, payloadHash, selections?: [{ optionId }] }` (strict) | 200 `{ receiptCode, status: "CAST" }` | OK |
| GET | `/api/voting/sessions/:id` | — | `{ id, electionId, voterId, startedAt, completedAt, isSuccessful }` | OK |

## Inicio de sesión de votación

`POST /api/voting/elections/:electionId/sessions` llama a la función SQL `start_voting_session(p_election_id UUID, p_voter_id UUID, p_ip_address INET, p_user_agent TEXT)` (SECURITY DEFINER). Secuencia:

1. Limpia sesiones huérfanas > 15 min.
2. Valida que la elección exista y esté `OPEN`.
3. Llama a **`can_user_vote(p_voter_id, v_period_id)`** (ver §Verificación del elector).
4. Rechaza si el usuario ya votó en esa elección (existe fila en `votes`).
5. Inserta en `voting_sessions` y devuelve el UUID de la sesión.

## Cast vote

`POST /api/voting/sessions/:sessionId/cast` llama a `cast_secure_vote_with_session(p_session_id UUID, p_voter_id UUID, p_encrypted_payload TEXT, p_payload_hash VARCHAR, p_selections JSONB)` (SECURITY DEFINER). Secuencia:

1. Bloquea la fila de la sesión con `FOR UPDATE`; valida que exista, no esté completada y pertenezca al votante autenticado.
2. Lee `election_rules.allow_blank_vote`; si `selections` está vacío y no se permiten votos en blanco → excepción.
3. Marca la sesión `is_successful=TRUE` y `completed_at` = ahora.
4. Genera un **`receipt_code` aleatorio de 64 hex**.
5. Inserta en `votes` (con `encryptedPayload`, `payloadHash`, `receiptCode`).
6. Inserta cada selección en `vote_selections` (uniendo a `ballot_options`/`ballot_positions` acotado a la elección); valida que el conteo casado coincida y que ningún cargo exceda `max_votes_per_position`.
7. Devuelve el `receipt_code`.

**El payload viene cifrado por el cliente.** El backend **no descifra** el contenido; guarda `encryptedPayload` y `payloadHash`. Los detalles de cifrado criptográfico (algoritmo, claves) **no están implementados en el backend** — `NO CONFIRMADO` qué esquema criptográfico usa el cliente.

## Verificación del elector

Función **`can_user_vote(p_user_id UUID, p_period_id UUID)`** (SQL, STABLE): devuelve TRUE si existe en `voter_registries` con `is_eligible=TRUE`, el usuario está `ACTIVE` y `is_verified=TRUE`, y el periodo académico está `is_active=TRUE`. Si FALSE → la sesión no se crea (excepción traducida a 403 `NOT_ELIGIBLE_TO_VOTE`).

## Prevención de doble voto (en capas)

1. **Al iniciar sesión:** si ya existe fila en `votes` para (election, voter) → excepción.
2. **Unicidad en BD:** `CONSTRAINT uq_votes_election_voter UNIQUE (election_id, voter_id)`.
3. **Sesión activa única:** índice único parcial `uq_voting_sessions_active_user (election_id, voter_id) WHERE completed_at IS NULL`; el inicio de sesión captura `unique_violation`.
4. **Lock + completado de sesión:** en `cast_secure_vote_with_session`, `FOR UPDATE` sobre la sesión y rechazo de sesiones ya completadas.
5. **Trigger** `validate_vote_integrity()` (BEFORE INSERT en `votes`): bloquea salvo sesión exitosa/completada, elección `OPEN`, coherencia election+voter y timestamps en rango.

## Ownership de sesión

- `GET /api/voting/sessions/:id`: verifica en el servicio que `session.voterId === actorId`; en otro caso **403** (voting.service.js).
- `cast_secure_vote_with_session` valida que la sesión pertenezca al `p_voter_id` (vía `FOR UPDATE`).

## Estados

- `voting_sessions`: `isSuccessful` (bool), `startedAt`, `completedAt` (nullable).
- `votes`: estado implícito por `receiptCode` y por la transacción que la inserta.

## Transacciones

`start_voting_session` y `cast_secure_vote_with_session` son funciones PL/pgSQL **SECURITY DEFINER** que ejecutan toda su lógica en una transacción única. El `tally` recomputable (ver §10) usa una transacción Prisma (`deleteMany`+`createMany`).

## Funciones SQL utilizadas en votación

| Función | Ubicación SQL | Qué hace |
|---|---|---|
| `start_voting_session` | `voting/004_start_session.sql` | Inicia sesión de votación (ver arriba) |
| `cast_secure_vote_with_session` | `voting/005_cast_vote.sql` | Emite el voto dentro de la sesión (ver arriba) |
| `can_user_vote` | `academic/007_functions.sql` | Valida elegibilidad del elector |
| `close_failed_session` | `voting/006_session_management.sql` | Cierra sesión fallida (no cableada a rutas) |
| `cleanup_orphan_sessions` | `voting/006_session_management.sql` | Limpia sesiones huérfanas (invocada por start) |
| `verify_vote_integrity` | `voting/007_vote_integrity.sql` | Recomputa hash de un voto (no cableada a rutas) |
| `verify_election_integrity` | `voting/007_vote_integrity.sql` | Integridad de toda una elección (no cableada a rutas) |
| Trigger `validate_vote_integrity()` | `voting/002_votes.sql` | Valida integridad en INSERT de `votes` |

> **Nota:** `verify_vote_integrity` y `verify_election_integrity` existen como funciones SQL pero **no** se encontraron endpoints HTTP que las expongan directamente. `NO CONFIRMADO` si hay una ruta pública para verificación de integridad de voto.

---

# 10. RESULTADOS

## Tally (escrutinio)

| Método | Ruta | Auth/Roles | Respuesta `data` | Estado |
|---|---|---|---|---|
| POST | `/api/elections/:id/tally/recalculate` | GESTORES | `{ electionId, deleted, inserted, optionsProcessed, positionsProcessed }` (solo si elección `CLOSED`; si no → 409) | OK |
| GET | `/api/elections/:id/tally` | GESTORES | array `[{ id, electionId, positionId, optionId, votesCount, updatedAt }]` | OK |

El `tally` se recalcula con Prisma (transacción `replaceTallies`: `deleteMany` + `createMany` a partir de `vote_selections`), no con una función SQL. Debe recalcularse solo con la elección `CLOSED`.

## Certificación

- **Endpoint:** `POST /api/elections/:id/certify` — GESTORES.
- **Flujo:** recalcula tallies → `changeStatus(id, 'CERTIFIED')` → registra audit `CERTIFY_RESULT`.
- **Función SQL:** `certify_election(p_election_id UUID, p_certifier_user_id UUID)` (SECURITY DEFINER) — autoriza al certificador (ADMIN/ELECTORAL_COMMISSION activo), valida elección `CLOSED`, ejecuta `tally_election_votes`, calcula electores/votos en blanco/nulos por alcance, hace upsert de `election_results` y marca la elección `CERTIFIED`. Exigida por `election_rules` de forma que `CERTIFIED` solo es alcanzable desde `CLOSED`.

> **ESTADO ACTUAL: ROTO** — `certify_election(UUID, UUID)` requiere 2 argumentos, pero el repository (`election.repository.js`) envía **solo 1**:
> ```js
> await prisma.$queryRaw`SELECT certify_election(${electionId}::uuid)`;
> ```
> Postgres devuelve `function certify_election(uuid) does not exist` (error P2010). Además, el `actor`/`certifier_user_id` **nunca se propaga** al SQL (el servicio de certificación no lo pasa). Ver V3 en §16. **No presentar la corrección como comportamiento actual.**

## Publicación

- **Endpoint:** `POST /api/elections/:id/publish` — GESTORES.
- **Flujo:** requiere elección `CERTIFIED` (si no → 409); lee `election_rules.min_turnout_percentage` (default 0); exige `election_results.turnout_percentage >= min` (quórum; si no → 409); `changeStatus(id, 'PUBLISHED')`; registra audit `PUBLISH_RESULT`.
- **Estado:** OK.

## Resultados consultables

| Método | Ruta | Auth/Roles | Respuesta `data` | Estado |
|---|---|---|---|---|
| GET | `/api/results/live?election_id=` | autenticado (sin role check) | estructura de resultados `live` | OK (status permitidos `CLOSED, CERTIFIED, PUBLISHED`) |
| GET | `/api/results/final?election_id=` | autenticado (sin role check) | estructura de resultados `final` | OK (solo `PUBLISHED`; si no → 404 `NOT AVAILABLE`) |

Estructura devuelta por `getFinalResults`/`getLiveResults`:

```json
{
  "election_id": "<uuid>",
  "status": "PUBLISHED",
  "summary": {
    "id": "<uuid>", "electionId": "<uuid>", "totalVoters": 1000,
    "totalVotesCast": 512, "turnoutPercentage": 51.2,
    "blankVotes": 8, "nullVotes": 3, "certifiedAt": "<ISO|null>",
    "publishedAt": "<ISO|null>", "reportPdf": null, "reportHash": null,
    "reportSignature": null, "createdAt": "<ISO>", "updatedAt": "<ISO>"
  },
  "detail": {
    "positions": [
      {
        "position_id": "<uuid>", "position_name": "string", "seats": 1,
        "options": [
          { "option_id": "<uuid>", "label": "string", "option_type": "CANDIDATE|LIST|BLANK|VOID",
            "candidate_list_id": "<uuid>|null", "votes_count": 120, "percentage": 45.66 }
        ]
      }
    ]
  }
}
```

## Reporte PDF y exportación

| Método | Ruta | Auth/Roles | Respuesta | Estado |
|---|---|---|---|---|
| GET | `/api/elections/:id/report.pdf` | autenticado (sin role check) | `application/pdf`, header `Content-Disposition: attachment; filename="acta-<id>.pdf"`, header `X-Content-Hash: <sha256>` | OK (ver nota de snake_case abajo) |
| GET | `/api/elections/:id/export.csv` | autenticado | `text/csv; charset=utf-8`, BOM UTF-8, CRLF, escapado de inyección de fórmulas | OK |
| GET | `/api/elections/:id/export.xlsx` | autenticado | hoja "Resultados" | OK |

> **Nota (discrepancia de formas):** el `report.service.js` espera claves **snake_case** (`total_voters`, `total_votes_cast`, `turnout_percentage`, `blank_votes`, `null_votes`) pero el servicio devuelve **camelCase** (`totalVoters`, ...). El PDF puede no mostrar correctamente esos valores derivados. `NO CONFIRMADO` el impacto visual exacto.

---

# 11. API ENDPOINT MATRIX

Todos bajo `/api`. `EC` = `ELECTORAL_COMMISSION`. `G` = GESTORES (ADMIN + EC). `✓` = autenticado (JWT). `—` = no requiere.

| Método | Endpoint | Auth | Roles | Request | Response | Errores | Estado |
|--------|----------|------|-------|---------|----------|---------|--------|
| GET | `/health` | — | — | — | `{status, timestamp, uptime}` | — | OK |
| GET | `/api/health` | — | — | — | envelope `{success,data:{timestamp,uptime},message}` | — | OK |
| GET | `/api/health/db` | — | — | — | `{connected, latency_ms}` | 500 DATABASE_ERROR | OK |
| POST | `/api/auth/register` | — | — | ver §3 | `{user}` | 400,409,503,429 | OK (mensaje incorrecto) |
| POST | `/api/auth/login` | — | — | `{email,password}` | `{requiresTotp,tempToken\|token,mustChangePassword,user}` | 400,401,403,423,429 | ROTO inst. limpia (V6) |
| POST | `/api/auth/totp/login-verify` | token TOTP | — | `{code\|backupCode}` | `{valid}` (+`remainingCodes`) | 400,401,403,429 | OK |
| POST | `/api/auth/otp/verify-login` | token TOTP | — | `{code/token\|backupCode}` | `{valid}` (+`remainingCodes`) | 400,401,403,429 | OK |
| POST | `/api/auth/totp/setup` | ✓ | — | — | `{secret,uri,backupCodes}` | 401,403,404,409,429 | OK |
| POST | `/api/auth/otp/setup` | ✓ | — | — | `{secret,uri,backupCodes}` | 401,403,404,409,429 | OK |
| POST | `/api/auth/totp/verify` | ✓ | — | `{code}` | `{message,backupCodes}` | 400,401,403,429 | OK |
| POST | `/api/auth/otp/verify` | ✓ | — | `{code\|token}` | `{backupCodes}` | 400,401,403,429 | OK |
| POST | `/api/auth/totp/disable` | ✓ | — | `{password}` | `{message}` | 400,401,403,429 | OK |
| POST | `/api/auth/otp/disable` | ✓ | — | `{password}` | `data:null` | 400,401,403,429 | OK |
| POST | `/api/auth/password/forgot` | — | — | `{email}` | `{message}` | 400,503,429 | OK |
| POST | `/api/auth/password/reset` | — | — | `{token,newPassword}` | `{message}` | 400,429 | OK |
| POST | `/api/auth/verify-email` | — | — | `{token}` | `{message}` | 400,429 | OK |
| POST | `/api/auth/verify-email/resend` | — | — | `{email}` | — | 500 | **ROTO** (V–func no existe) |
| POST | `/api/auth/logout` | ✓ | — | — | `{loggedOut}` | 401,403 | OK (revoca todos los refresh) |
| GET | `/api/auth/me` | ✓ | — | — | profile | 401,403,404 | OK |
| GET | `/api/users/` | ✓ | ADMIN, EC | query | paginado | 401,403 | OK |
| GET | `/api/users/me` | ✓ | — | — | profile | 401 | OK |
| GET | `/api/users/:id` | ✓ | — | — | profile | 401,403,404 | OK (anti-IDOR) |
| POST | `/api/users/` | ✓ | ADMIN | body | 201 profile | 400,401,403,409 | OK |
| PUT | `/api/users/me` | ✓ | — | body | profile | 400,401 | OK |
| PUT | `/api/users/:id` | ✓ | ADMIN | body | profile | 400,401,403,404 | OK |
| PATCH | `/api/users/:id/role` | ✓ | ADMIN | `{role}` | profile | 400,401,403,404 | OK (V8: no revoca JWT) |
| PATCH | `/api/users/:id/status` | ✓ | ADMIN | `{is_active}` | profile | 400,401,403,404 | OK |
| PATCH | `/api/users/:id/unlock` | ✓ | ADMIN | — | profile | 401,403,404 | OK |
| POST | `/api/users/me/password` | ✓ | — | body | `{changed}` | 400,401 | OK |
| POST | `/api/organizations/requests` | — | — | body | solicitud | 400 | OK |
| GET | `/api/organizations/requests` | ✓ | ADMIN | query | paginado | 401,403 | OK |
| GET | `/api/organizations/requests/:id` | ✓ | ADMIN | — | solicitud | 401,403,404 | OK |
| PATCH | `/api/organizations/requests/:id/approve` | ✓ | ADMIN | — | organización | 401,403,404 | OK |
| PATCH | `/api/organizations/requests/:id/reject` | ✓ | ADMIN | `{rejection_reason}` | solicitud | 400,401,403,404 | OK |
| GET | `/api/organizations/` | —(público) | — | query | paginado | 400 | OK |
| POST | `/api/organizations/` | ✓ | ADMIN | body | 201 org | 400,401,403,409 | OK |
| GET | `/api/organizations/:id` | —(público) | — | — | org | 404 | OK |
| PATCH | `/api/organizations/:id` | ✓ | ADMIN | body | org | 400,401,403,404 | OK |
| DELETE | `/api/organizations/:id` | ✓ | ADMIN | — | `{deleted:true}` | 401,403,404 | OK |
| PATCH | `/api/organizations/:id/onboarding` | ✓ | ADMIN | — | org | 401,403,404 | OK |
| POST | `/api/organizations/:id/onboarding/complete` | ✓ | ADMIN | — | org | 401,403,404 | OK |
| GET | `/api/academic/faculties/` | ✓ | ADMIN | — | lista | 401,403 | OK |
| POST | `/api/academic/faculties/` | ✓ | ADMIN | body | 201 facultad | 400,401,403 | OK |
| GET | `/api/academic/faculties/:id` | ✓ | ADMIN | — | facultad | 401,403,404 | OK |
| PUT | `/api/academic/faculties/:id` | ✓ | ADMIN | body | facultad | 400,401,403,404 | OK |
| DELETE | `/api/academic/faculties/:id` | ✓ | ADMIN | — | `{deleted:true}` | 401,403,404 | OK |
| GET | `/api/academic/programs/` | ✓ | ADMIN | — | lista | 401,403 | OK |
| POST | `/api/academic/programs/` | ✓ | ADMIN | body | 201 programa | 400,401,403,409 | OK |
| GET | `/api/academic/programs/:id` | ✓ | ADMIN | — | programa | 401,403,404 | OK |
| PUT | `/api/academic/programs/:id` | ✓ | ADMIN | body | programa | 400,401,403,404 | OK |
| DELETE | `/api/academic/programs/:id` | ✓ | ADMIN | — | `{deleted:true}` | 401,403,404 | OK |
| GET | `/api/academic/periods/` | ✓ | ADMIN | — | lista | 401,403 | OK |
| POST | `/api/academic/periods/` | ✓ | ADMIN | body | 201 periodo | 400,401,403 | OK |
| GET | `/api/academic/periods/:id` | ✓ | ADMIN | — | periodo | 401,403,404 | OK |
| PUT | `/api/academic/periods/:id` | ✓ | ADMIN | body | periodo | 400,401,403,404 | OK |
| PATCH | `/api/academic/periods/:id/active` | ✓ | ADMIN | — | periodo | 401,403,404 | OK |
| DELETE | `/api/academic/periods/:id` | ✓ | ADMIN | — | `{deleted:true}` | 401,403,404 | OK |
| POST | `/api/academic/voter-registries/sync-sis` | ✓ | G | `{periodId, students[]}` | resultado sincronización | 400,401,403 | OK |
| GET | `/api/academic/voter-registries/` | ✓ | G | query | `{data,meta:{page,limit,total,totalPages}}` | 400,401,403 | OK |
| POST | `/api/academic/voter-registries/` | ✓ | G | body | 201 votante | 400,401,403,409 | OK |
| GET | `/api/academic/voter-registries/:id` | ✓ | G | — | votante | 401,403,404 | OK |
| PATCH | `/api/academic/voter-registries/:id` | ✓ | G | body | votante | 400,401,403,404 | OK |
| DELETE | `/api/academic/voter-registries/:id` | ✓ | G | — | `{message}` | 401,403,404 | OK |
| GET | `/api/elections` | ✓ | — | query | paginado | 400,401 | OK |
| GET | `/api/elections/:id` | ✓ | — | — | elección | 401,404 | OK |
| POST | `/api/elections` | ✓ | G | body | 201 elección | 400,401,403,409 | OK |
| PATCH | `/api/elections/:id` | ✓ | G | body | elección | 400,401,403,404,409 | OK |
| DELETE | `/api/elections/:id` | ✓ | ADMIN | — | `{deleted:true}` | 401,403,404 | OK |
| PATCH | `/api/elections/:id/status` | ✓ | G | `{status}` | elección | 400,401,403,404,409 | Parcial (CERTIFIED→V3) |
| GET | `/api/elections/:electionId/positions` | ✓ | — | — | lista | 401 | OK |
| GET | `/api/elections/:electionId/positions/:id` | ✓ | — | — | posición | 401,404 | OK |
| POST | `/api/elections/:electionId/positions` | ✓ | G | body | 201 posición | 400,401,403,409 | OK |
| PATCH | `/api/elections/:electionId/positions/:id` | ✓ | G | body | posición | 400,401,403,404,409 | OK |
| DELETE | `/api/elections/:electionId/positions/:id` | ✓ | G | — | `{deleted:true}` | 401,403,404,409 | OK |
| GET | `/api/elections/:electionId/candidate-lists` | ✓ | — | — | lista | 401 | OK |
| GET | `/api/elections/:electionId/candidate-lists/:id` | ✓ | — | — | lista | 401,404 | OK |
| POST | `/api/elections/:electionId/candidate-lists` | ✓ | G | body | 201 lista | 400,401,403 | OK |
| PUT | `/api/elections/:electionId/candidate-lists/:id` | ✓ | G | body | lista | 400,401,403,404 | OK |
| PATCH | `/api/elections/:electionId/candidate-lists/:id` | ✓ | G | body | lista | 400,401,403,404 | OK |
| DELETE | `/api/elections/:electionId/candidate-lists/:id` | ✓ | G | — | `{deleted:true}` | 401,403,404,409 | OK |
| GET | `/api/elections/:electionId/candidacies` | ✓ | — | query | lista | 400,401 | OK |
| GET | `/api/elections/:electionId/candidacies/:id` | ✓ | — | — | candidatura | 401,404 | OK |
| POST | `/api/elections/:electionId/candidacies` | ✓ | G | body | 201 candidatura | 400,401,403,404,409 | ROTO en instalación limpia (V2) |
| PUT | `/api/elections/:electionId/candidacies/:id` | ✓ | G | body | candidatura | 400,401,403,404,409 | ROTO en instalación limpia (V2) |
| PATCH | `/api/elections/:electionId/candidacies/:id` | ✓ | G | body | candidatura | 400,401,403,404,409 | ROTO en instalación limpia (V2) |
| DELETE | `/api/elections/:electionId/candidacies/:id` | ✓ | G | — | `{deleted:true}` | 401,403,404,409 | ROTO en instalación limpia (V2) |
| GET | `/api/elections/:electionId/rules` | ✓ | — | — | reglas | 401,404 | OK |
| POST | `/api/elections/:electionId/rules` | ✓ | G | body | 201 reglas | 400,401,403,409 | OK |
| PATCH | `/api/elections/:electionId/rules` | ✓ | G | body | reglas | 400,401,403,404 | OK |
| DELETE | `/api/elections/:electionId/rules` | ✓ | G | — | `{deleted:true}` | 401,403,404 | OK |
| GET | `/api/ballots/election/:electionId/active` | ✓ | — | — | `{id,version,generatedAt}` | 401,404 | OK |
| POST | `/api/ballots/election/:electionId/version` | ✓ | G | — | 201 ballot | 400,401,403 | OK |
| GET | `/api/ballots/:id/completeness` | ✓ | — | — | `{ballotId,isComplete}` | 401,404 | OK |
| GET | `/api/ballots` | ✓ | — | query `electionId` (400 si falta) | paginado | 400,401 | OK |
| GET | `/api/ballots/:id` | ✓ | — | — | ballot | 401,404 | OK |
| POST | `/api/ballots` | ✓ | G | `{electionId}` | 201 ballot | 400,401,403 | OK |
| PUT | `/api/ballots/:id` | ✓ | G | `{isActive}` | ballot | 400,401,403,404 | OK |
| DELETE | `/api/ballots/:id` | ✓ | G | — | `{deleted:true}` | 401,403,404 | OK |
| GET | `/api/ballots/:ballotId/positions` | ✓ | — | — | lista | 401 | OK |
| GET | `/api/ballots/:ballotId/positions/:id` | ✓ | — | — | posición de cédula | 401,404 | OK |
| POST | `/api/ballots/:ballotId/positions` | ✓ | G | `{positionId/position_id, orderIndex}` | 201 | 400,401,403 | OK |
| PUT | `/api/ballots/:ballotId/positions/:id` | ✓ | G | body | posición | 400,401,403,404 | OK |
| DELETE | `/api/ballots/:ballotId/positions/:id` | ✓ | G | — | `{deleted:true}` | 401,403,404 | OK |
| GET | `/api/ballots/:ballotId/positions/:ballotPositionId/options` | ✓ | — | — | lista | 401 | OK |
| GET | `/api/ballots/:ballotId/positions/:ballotPositionId/options/:id` | ✓ | — | — | opción | 401,404 | OK |
| POST | `/api/ballots/:ballotId/positions/:ballotPositionId/options` | ✓ | G | `{optionType, candidateListId, label}` | 201 | 400,401,403,409 | OK |
| PUT | `/api/ballots/:ballotId/positions/:ballotPositionId/options/:id` | ✓ | G | body | opción | 400,401,403,404 | OK |
| DELETE | `/api/ballots/:ballotId/positions/:ballotPositionId/options/:id` | ✓ | G | — | `{deleted:true}` | 401,403,404 | OK |
| POST | `/api/voting/elections/:electionId/sessions` | ✓ | — | — | `{sessionId,electionId,status}` | 400,401,403,404,409 | ROTO inst. limpia (V6/V1) |
| POST | `/api/voting/sessions/:sessionId/cast` | ✓ | — | body | `{receiptCode,status}` | 400,401,403,404,409,422 | ROTO inst. limpia (V6/V1) |
| GET | `/api/voting/sessions/:id` | ✓ | — | — | sesión | 401,403,404 | ROTO inst. limpia (V1) |
| POST | `/api/elections/:id/certify` | ✓ | G | — | elección | 400,401,403,404,409 | **ROTO (V3)** |
| POST | `/api/elections/:id/publish` | ✓ | G | — | elección | 400,401,403,404,409 | OK |
| POST | `/api/elections/:id/tally/recalculate` | ✓ | G | — | `{electionId,deleted,inserted,...}` | 400,401,403,409 | OK |
| GET | `/api/elections/:id/tally` | ✓ | G | — | array tally | 401,403 | OK |
| GET | `/api/results/live?election_id=` | ✓ | — | query | resultados | 400,401,404 | OK |
| GET | `/api/results/final?election_id=` | ✓ | — | query | resultados | 400,401,404 | OK |
| GET | `/api/elections/:id/report.pdf` | ✓ | — | — | PDF + headers | 401,404 | OK (discrepancia camel/snake) |
| GET | `/api/elections/:id/export.csv` | ✓ | — | — | CSV | 401,404 | OK |
| GET | `/api/elections/:id/export.xlsx` | ✓ | — | — | XLSX | 401,404 | OK |
| GET | `/api/audit/logs` | ✓ | G | query | paginado | 401,403 | OK |
| GET | `/api/audit/logs/:id` | ✓ | G | — | log | 401,403,404 | OK |
| POST | `/api/audit/logs` | ✓ | G | body | log | 400,401,403 | OK |
| POST | `/api/audit/tokens` | ✓ | — | body | `{success,data:{tokenRecord},token,message}` (`token` top-level) | 400,401,403,409 | OK |
| POST | `/api/audit/tokens/consume` | — | — | body | `{success,data:{consumed,message}}` | 404,409,410,429 | OK (cabina; confirmar req.) |
| GET | `/api/audit/tokens/status` | — | — | query | `{success,data:status}` | 400,429 | OK |
| DELETE | `/api/audit/tokens/cleanup` | ✓ | ADMIN/internal | — | `{success,data,message}` | 401,403 | OK |
| GET | `/api/notifications/unread-count` | ✓ | — | — | `{unread_count}` | 401 | OK |
| GET | `/api/notifications/` | ✓ | — | query | paginado | 400,401 | OK |
| POST | `/api/notifications/` | ✓ | ADMIN, EC | body | `{notification, deliveries_scheduled}` | 400,401,403 | OK |
| PATCH | `/api/notifications/mark-all-read` | ✓ | — | — | — | 401 | OK |
| PATCH | `/api/notifications/:id` | ✓ | — | `{is_read?,metadata?}` | notificación | 400,401,404 | OK |
| GET | `/api/platform/translations/dictionary` | — | — | query `locale, category` | diccionario | 400 | OK |
| GET | `/api/platform/translations/effective-locale/:userId` | ✓ | ADMIN | — | `{locale}` | 401,403 | OK |
| GET | `/api/platform/translations/` | ✓ | ADMIN | — | lista | 401,403 | OK |
| GET | `/api/platform/translations/:id` | ✓ | ADMIN | — | traducción | 401,403,404 | OK |
| POST | `/api/platform/translations/` | ✓ | ADMIN | body | 201 | 400,401,403 | OK |
| PATCH | `/api/platform/translations/:id` | ✓ | ADMIN | body | traducción | 400,401,403 | OK |
| DELETE | `/api/platform/translations/:id` | ✓ | ADMIN | — | `{deleted:true}` | 401,403,404 | OK |

---

# 12. ERRORES HTTP

El backend representa errores con un envelope global de `errorHandler`:

```json
{
  "success": false,
  "error": {
    "code": "<code>",
    "message": "<mensaje>",
    "details": { ... } | [ ... ] | null,
    "stack": "..."
  },
  "timestamp": "<ISO>",
  "path": "/api/..."
}
```

| HTTP | `code` típico | Cuándo |
|------|----------------|--------|
| 400 | `BAD_REQUEST`, `VALIDATION_ERROR`, `PRISMA_VALIDATION_ERROR`, `INVALID_JSON` | Validación Zod (el live produce 400), JSON malformado, referencia inválida |
| 401 | `UNAUTHORIZED`, `INVALID_TOKEN`, `JWT_ERROR`, `INVALID_CREDENTIALS` | Token ausente, expirado o inválido; credenciales incorrectas |
| 403 | `FORBIDDEN`, `ACCOUNT_NOT_VERIFIED`, `NOT_ELIGIBLE_TO_VOTE` | Rol no autorizado, email sin verificar, TOTP pendiente, elector no elegible |
| 404 | `NOT_FOUND`, `ROUTE_NOT_FOUND`, `ELECTION_NOT_FOUND` | Recurso inexistente, ruta no encontrada |
| 409 | `CONFLICT`, `PRISMA_P2002`, `ALREADY_VOTED`, `TOKEN_ALREADY_USED`, `ELECTION_NOT_OPEN`, `INVALID_VOTING_SESSION` | Duplicados, transiciones no permitidas, doble voto, token ya usado |
| 410 | `TOKEN_EXPIRED` | Token de un solo uso expirado |
| 422 | `UNPROCESSABLE_ENTITY`, `INVALID_BALLOT`, `INVALID_DIGITAL_SIGNATURE` | Fallos de negocio de cédula/firma |
| 423 | `ACCOUNT_LOCKED` | Cuenta bloqueada por intentos fallidos |
| 429 | body plano `{status/message}` (no-envelope) o `TOO_MANY_REQUESTS` | Rate limiting |
| 500 | `INTERNAL_SERVER_ERROR`, `UNKNOWN_ERROR`, `DATABASE_QUERY_FAILED`, `PRISMA_*` | Errores no manejados, SQL fallido (ej. P2010), errores de BD |
| 503 | `SERVICE_UNAVAILABLE`, `PRISMA_P1001`, `EMAIL_SEND_FAILED` | BD no disponible, envío de email fallido |
| 504 | `PRISMA_P1008` | Timeout de BD |

**Detalles de validación:** el middleware `validate` produce **400** con `details: [{ field, message }]` por cada campo. (Nota: `ApiError.fromError` mapearía un ZodError a 422, pero el comportamiento en vivo del `validate.middleware.js` + `errorHandler` es 400.)

**Rate limiting (excepcional, no usa el envelope):**
- Global `/api`: `{ "status": 429, "message": "Demasiadas solicitudes, intenta más tarde." }`
- `loginLimiter` (5/15min): `{ "status": "error", "message": "Demasiados intentos de inicio de sesión. Por favor, reintente en 15 minutos." }`
- `authLimiter` (10/60min): `{ "status": "error", "message": "Demasiadas solicitudes enviadas desde esta IP. Intente más tarde." }`
- `tokenRateLimiter` (30/15min): `{ "success": false, "error": { "message": "...", "details": null } }`

Los limitadores usan headers estándar `RateLimit-*` (`standardHeaders: true`, `legacyHeaders: false`).

---

# 13. FORMATO DE RESPUESTAS JSON

## Envelope estándar (mayoría de módulos) — `apiResponse.js`

`sendSuccess` (200/201):
```json
{ "success": true, "message": "...", "data": <payload>, "meta": { "timestamp": "<ISO>" } }
```
- Muchos controllers añaden `requestId` en `meta`: `"meta": { "timestamp": "...", "requestId": "<uuid>" }`.

`sendPaginated` (200):
```json
{
  "success": true,
  "message": "...",
  "data": [ ... ],
  "meta": {
    "timestamp": "<ISO>",
    "pagination": { "page": 1, "limit": 10, "total": 0, "totalPages": 0, "hasNext": false, "hasPrev": false }
  }
}
```

Eliminación → `data: { "deleted": true }` (mayoría de módulos).

## Envelope de errores — §12.

## `formatUserResponse` (usuarios — snake_case)

```json
{
  "id": "<uuid>",
  "username": "...",
  "email": "...",
  "first_name": "...",
  "last_name": "...",
  "role": "STUDENT",
  "institutional_id": "...",
  "organization_id": "<uuid>",
  "is_verified": true,
  "status": "ACTIVE",
  "is_staff": false,
  "is_superuser": false,
  "two_factor_enabled": false,
  "must_change_password": false,
  "last_login": "<ISO>|null",
  "date_joined": "<ISO>"
}
```
(Algunos campos pueden quedar ausentes según qué seleccione el repo: tras `register` solo `id, username, email, role, status, date_joined`; tras `login` no hay `date_joined`.)

## Diferencias de forma por módulo

- **La mayoría** devuelve claves **camelCase** (elección, posición, lista, ballot, ballot-position, ballot-option, sesión de votación, tally).
- **Candidatura** y **Reglas de elección** devuelven claves **snake_case** (`candidacy.service.js`, `electionRules.service.js`).
- **Notificaciones** devuelven snake_case (`id, user_id, type, title, message, metadata, is_read, read_at, created_at`).
- **Voter-registry** (`/api/academic/voter-registries`) usa un envelope **diferente** (respuestas `res.json` directas, no `apiResponse`):
  - `syncSis`: `{ success, message, data }`
  - `createVoter`: 201 `{ success, message, data }`
  - `getVoters`: `{ success, data: [...], meta: { page, limit, total, totalPages } }` (sin `message`, sin `timestamp`)
  - `getVoterById`: `{ success, data }`
  - `updateVoter`: `{ success, message, data }`
  - `deleteVoter`: `{ success, message }` (sin `data`)
- **Audit** usa respuestas directas (p. ej. consume → `{ success, data: { consumed, message } }`).
- **Health público** (`GET /health`) → `{ status, timestamp, uptime }` (sin envelope `success`).

**Conclusión para el cliente:** no hay un único envelope garantizado para toda la API. Lo más común es `{ success, message, data, meta }`, pero **voter-registry, audit y health divergen**. El cliente debe validar `success` y la existencia de `data`/`error` de forma tolerante.

---

# 14. HEADERS

| Header | Formato | Cuándo / Detalle |
|---|---|---|
| `Authorization` | `Bearer <JWT>` | Requerido en rutas protegidas; verificado contra `JWT_SECRET` con HS256 |
| `Content-Type` | `application/json` | Body JSON (límite `10mb`) |
| `X-Request-Id` | `<uuid>` | Set en cada respuesta (middleware de correlación); echo en `meta.requestId` de muchos success |
| `X-Content-Hash` | `<sha256 hex>` | Solo en `GET /api/elections/:id/report.pdf` |
| `Content-Disposition` | `attachment; filename="acta-<id>.pdf"` / `"resultados-<id>.csv"` | Solo en descargas report/export |
| `RateLimit-*` | estándar | Presente tras superar límites |

**CORS** (`src/config/cors.js`): `origin` = env `CORS_ORIGIN` (default `http://localhost:5173`); `methods` = `GET, POST, PUT, DELETE, PATCH, OPTIONS`; `allowedHeaders` = `Content-Type, Authorization, X-Requested-With`; `credentials: true`; `optionsSuccessStatus: 200`.

> **Importante para Swift:** `CORS_ORIGIN` está restringido. Aunque una app móvil nativa no envía headers `Origin` obligatorios, cualquier acceso HTTP de un origen no permitido será bloqueado por CORS en navegador. Para la app Swift (fuera del navegador) CORS no aplica normalmente, pero el servidor debe poder aceptar el origen del entorno si se usa vía web. `NO CONFIRMADO` si el despliegue permite el origen de la app.

**Juicio del servidor** (`trust proxy: 1` está activo).

---

# 15. BASE DE DATOS

## Tecnología

PostgreSQL 16 (contenedor Docker, puerto externo `5433`) + Prisma Client + extensión `citext`. Sin directorio `prisma/migrations` (el esquema se construye con los SQL de `database/sql/`).

## Modelos Prisma y tablas relevantes

| Modelo | Tabla | Notas |
|---|---|---|
| `User` | `users` | roles, status, 2FA, dato académico autodeclarado |
| `RefreshToken` | `refresh_tokens` | — **no se crea** (V1) |
| `OneTimeToken` | `one_time_tokens` | — **no se crea** (V1) |
| `EmailVerificationToken` | `email_verification_tokens` | creación vía SQL (`006_email_verification.sql` / `007` real) |
| `PasswordResetToken` | `password_reset_tokens` | creación vía SQL |
| `Organization` | `organizations` | multitenant |
| `OrganizationRequest` | `organization_requests` | solicitudes |
| `Faculty` | `faculties` | dominio académico |
| `Program` | `programs` | dominio académico |
| `AcademicPeriod` | `academic_periods` | periodo |
| `VoterRegistry` | `voter_registries` | **padrón** (gobierna la elegibilidad real) |
| `Election` | `elections` | proceso electoral |
| `Position` | `positions` | cargos |
| `CandidateList` | `candidate_lists` | listas |
| `Candidacy` | `candidacies` | **usa `candidacy_status_type` (V2)** |
| `ElectionRule` | `election_rules` | reglas |
| `CandidacyDocument` | `candidacy_documents` | documentos |
| `Ballot` | `ballots` | cédula |
| `BallotPosition` | `ballot_positions` | posición en cédula |
| `BallotOption` | `ballot_options` | opción |
| `Tally` | `tallies` | escrutinio |
| `VotingSession` | `voting_sessions` | sesión de votación |
| `Vote` | `votes` | voto (payload cifrado + hash + receipt) |
| `VoteSelection` | `vote_selections` | selecciones |
| `ElectionResult` | `election_results` | acta |
| `AuditLog` | `audit_logs` | log encadenado por hash |
| `VotingAccessToken` | `voting_access_tokens` | token de un solo uso |
| `Notification` | `notifications` | notificaciones |
| `NotificationDelivery` | `notification_deliveries` | canales |
| `PlatformTranslation` | (ver SQL i18n) | traducciones |

## Enums (PG) y dónde se crean

| Enum PG | Valores | Creado en |
|---|---|---|
| `user_role` | STUDENT, TEACHER, ADMIN, ELECTORAL_COMMISSION, OBSERVER | `user/001_enums.sql` |
| `user_status` | PENDING, ACTIVE, SUSPENDED, DELETED | `user/001_enums.sql` |
| `auth_provider_type` | LOCAL, GOOGLE, AWS | `user/001_enums.sql` |
| `avatar_type` | DEFAULT_DICEBEAR, UPLOADED, GRAVATAR | `user/001_enums.sql` |
| `organization_type` | UNIVERSITY, INSTITUTE, SCHOOL, COMPANY, ASSOCIATION, OTHER | `organizations/001_enums.sql` |
| `organization_request_status` | PENDING, APPROVED, REJECTED | `organizations/001_enums.sql` |
| `election_process_type` | VOTE, FAIR, FEEDBACK, FORM | `elections/001_enums.sql` |
| `election_scope_type` | UNIVERSITY, FACULTY, PROGRAM | `elections/001_enums.sql` |
| `election_status_type` | DRAFT, SCHEDULED, OPEN, CLOSED, CERTIFIED, PUBLISHED | `elections/001_enums.sql` |
| `candidacy_document_type` | WORK_PLAN, CV, ID_CARD, OTHER | `elections/007_candidacy_documents.sql` |
| `ballot_option_type` | CANDIDATE_LIST, BLANK, VOID | `ballots/001_enums.sql` |
| `audit_action_type` | LOGIN, VERIFY_2FA, CREATE_ELECTION, OPEN_ELECTION, CAST_VOTE, CLOSE_ELECTION, CERTIFY_RESULT, PUBLISH_RESULT | `audit/001_enums.sql` |
| `notification_type` | ELECTION_OPENING, VOTE_CONFIRMATION, RESULTS_PUBLISHED, CANDIDACY_APPROVED, SYSTEM_ALERT | `notifications/001_notifications.sql` |
| `delivery_channel` | IN_APP, EMAIL, PUSH | `notifications/001_notifications.sql` |
| `delivery_status` | PENDING, SENT, FAILED | `notifications/001_notifications.sql` |
| `candidacy_status_type` | — | **NO SE CREA EN NINGÚN SQL (V2)** 🟠 |

## Funciones SQL clave

Ver §9 y §10 para firmas completas. Resumen:
- `start_voting_session`, `cast_secure_vote_with_session`, `can_user_vote`, `get_eligible_voters`, `close_failed_session`, `cleanup_orphan_sessions`, `verify_vote_integrity`, `verify_election_integrity`, `certify_election`, `tally_election_votes`, funciones de login (`login_is_allowed`, `register_failed_login`, `register_successful_login`), token de un solo uso (`consume_voting_access_token`), password reset y email verification.

## Transacciones

- Las funciones PL/pgSQL de votación y certificación son transaccionales (una sola transacción).
- El `tally` recomputable usa una transacción Prisma explícita.
- `audit_logs` usa una cadena de hash (tamper-evident).

---

# 16. KNOWN BACKEND ISSUES

# ⚠️ KNOWN BACKEND ISSUES

### V1 — `user/005_refresh_tokens.sql` corrupto

```
ID: V1
Severity: 🔴 CRÍTICO
Affected Files: database/sql/user/005_refresh_tokens.sql; prisma/schema/user.prisma:163-193; src/modules/auth/repositories/auth.repository.js:181-210; database/sql/user/006_password_reset.sql:143; database/init/01-create-app-user.sh
Current Behavior: El archivo contiene solo la letra "z". La tabla refresh_tokens (y one_time_tokens) nunca se crea, aunque Prisma (RefreshToken/OneTimeToken) y el repo la exigen. En la ruta Docker (01-create-app-user.sh itera globs con ON_ERROR_STOP=1) provoca error de sintaxis que aborta el init completo; en las rutas ps1/tests el archivo se omite.
Impact: login/refresh (auth.repository.js:181-210) y el logout (revokeAllUserRefreshTokens) operan sobre tablas inexistentes; la instalación limpia por Docker aborta.
Status: CONFIRMADO — BUG / BLOQUEADOR
```

### V2 — `candidacy_status_type` inexistente

```
ID: V2
Severity: 🔴 CRÍTICO
Affected Files: database/sql/elections/005_candidacies.sql:10; database/sql/elections/007_candidacy_documents.sql:43; prisma/schema/election.prisma:17; database/sql/elections/001_enums.sql (no lo define)
Current Behavior: El tipo enum `candidacy_status_type` se usa como tipo de columna y de variable PL/pgSQL, pero no existe ningún `CREATE TYPE candidacy_status_type ...` en database/sql/. Error: "type candidacy_status_type does not exist".
Impact: la tabla `candidacies` (y la función 007) no se crean; las candidaturas no pueden persistirse. GET/POST/PUT de candidacy devuelven error 500 en instalación limpia.
Status: CONFIRMADO — BUG / BLOQUEADOR
```

### V3 — `certify_election` con aridad incorrecta

```
ID: V3
Severity: 🟠 ALTO
Affected Files: database/sql/results/005_certify_election.sql:7-10; src/modules/elections/elections/election.repository.js:111; src/modules/results/certification/certification.service.js:31-41
Current Behavior: La función SQL `certify_election(p_election_id UUID, p_certifier_user_id UUID)` requiere 2 argumentos, pero el repository envía solo 1: `SELECT certify_election(${electionId}::uuid)`. Además el actor/certificador nunca se propaga al SQL.
Impact: `POST /api/elections/:id/certify` siempre falla con "function certify_election(uuid) does not exist" (P2010). La certificación no funciona.
Status: CONFIRMADO — BUG / BLOQUEADOR
```

### V4 — Conexión mediante superusuario `postgres` en `.env` de desarrollo

```
ID: V4
Severity: 🟠 ALTO (seguridad)
Affected Files: .env:6 (DATABASE_URL postgres:postgres); .env.example:16 (campusvote_app); docker-compose.yml
Current Behavior: El `.env` activo conecta la aplicación como superusuario `postgres`. El diseño previsto (rol restringido `campusvote_app`) no se usa en el entorno activo.
Impact: cualquier vulnerabilidad de la app = control total de la BD (incluido DDL). Secrets en claro y endebles en .env (POSTGRES_APP_PASSWORD=admin).
Status: CONFIRMADO (en desarrollo) — SECURITY ISSUE
```

### V6 — Scripts `db-setup.ps1` y `setup-db.js` desfasados

```
ID: V6
Severity: 🔴 CRÍTICO
Affected Files: scripts/db-setup.ps1:25-28; tests/setup-db.js:136-139; database/sql/user/006..009
Current Behavior: Referencian nombres inexistentes ("005_password_reset.sql", "006_email_verification.sql", "007_login_security.sql", "008_cleanup_tokens.sql") desplazados respecto a los reales (006_password_reset, 007_email_verification, 008_login_security, 009_cleanup_tokens). Las funciones de seguridad de login (login_is_allowed, register_failed_login, register_successful_login) nunca se cargan en instalación/test limpio.
Impact: login (auth.service.js:31 usa loginIsAllowed) y bloqueo de cuenta no funcionan en instalación limpia; el globalSetup de Jest colapsa (test setup roto).
Status: CONFIRMADO — BUG / BLOQUEADOR
```

### V8 — Rol del JWT no se revoca inmediatamente al cambiar rol

```
ID: V8
Severity: 🟠 MEDIO (seguridad)
Affected Files: src/middlewares/auth.middleware.js:96; src/modules/auth/services/auth.helpers.js:18; src/modules/users/user.service.js:162
Current Behavior: `authorize` lee `req.user.role` del JWT. `updateRole` (user.service.js:162) solo actualiza la BD; no revoca tokens vigentes. Un ADMIN degradado conserva rol:ADMIN hasta la expiración (24h, V10).
Impact: privilegios "zombies" por hasta 24h tras cambio de rol.
Status: CONFIRMADO — SECURITY ISSUE
```

### V9 — Infraestructura de refresh tokens sin flujo de consumo

```
ID: V9
Severity: 🟡 BAJO
Affected Files: src/modules/auth/services/auth.helpers.js:31-43; src/modules/auth/repositories/auth.repository.js:181-210; src/modules/auth/routes/auth.routes.js (sin /refresh); src/modules/auth/services/auth.service.js:20-70,161-172
Current Behavior: `generateRefreshToken`/`hashToken`/`createRefreshToken`/`findRefreshToken` se definen pero nunca se llaman; no hay ruta /refresh; login no crea refresh tokens; logout ejecuta revokeAllUserRefreshTokens sobre nada (tablas ni siquiera existen, V1).
Impact: la "seguridad de sesión" aparente por refresh no existe; el logout no invalida el access token.
Status: CONFIRMADO (infraestructura muerta) — BUG
```

### V10 — JWT efectivo de 24h

```
ID: V10
Severity: 🟡 MEDIO
Affected Files: .env:12; src/config/env.js:66; src/modules/auth/services/auth.helpers.js:13
Current Behavior: `JWT_EXPIRES_IN=24h`. El default '15m' del helper queda anulado por env.
Impact: ventana larga de validez del access token (agrava V8).
Status: CONFIRMADO — RECOMMENDATION (bajar a 15-30m)
```

### V — `/auth/verify-email/resend` roto (función inexistente)

```
ID: V-EXTRA
Severity: 🟠 ALTO
Affected Files: src/modules/auth/controllers/auth.controller.js:65-74; src/modules/auth/services/auth.service.js (no exporta resendVerification)
Current Behavior: El controller llama `authService.resendVerification(...)` pero el servicio no la exporta → TypeError → 500.
Impact: no se puede reenviar el correo de verificación.
Status: CONFIRMADO — BUG
```

### TEST SETUP — `.env.test` inexistente y `globalSetup` fallando

```
ID: TEST-SETUP
Severity: 🔴 CRÍTICO
Affected Files: jest.config.js:16 (globalSetup=./tests/setup-db.js); tests/setup-db.js:3,12-16 (carga .env.test); .env.test (NO existe)
Current Behavior: `setup-db.js` hace dotenv.config({path:'.env.test'}) pero `.env.test` no existe → DATABASE_URL indefinido → throw en línea 15-16. Además el step 16 falla por nombres inexistentes (V6).
Impact: los tests de integración que usan globalSetup no corren desde instalación limpia. La "suite verde" previa corresponde a runs con config temporal.
Status: CONFIRMADO — BUG / BLOQUEADOR
```

---

# 17. CLASIFICACIÓN DE PROBLEMAS (¿BUG / SEGURIDAD / RECOMENDACIÓN / NO CONFIRMADO?)

| ID | Clasificación | Razonamiento |
|---|---|---|
| V1 | **BUG** (bloqueador) | Debe funcionar (tablas de sesión) pero no se crean; aborta instalación Docker |
| V2 | **BUG** (bloqueador) | Tipo DB referenciado pero no creado; candidaturas no funcionan |
| V3 | **BUG** (bloqueador) | Llamada SQL con aridad incorrecta; certificación rota |
| V4 | **SECURITY ISSUE** | Conexión como superusuario + secrets en claro |
| V6 | **BUG** (bloqueador) | Scripts ps1/test con nombres inexistentes; login security nunca carga |
| V8 | **SECURITY ISSUE** | Rol del JWT no se revoca al cambiar rol |
| V9 | **BUG** (infraestructura muerta) | Refresh tokens sin flujo de consumo |
| V10 | **RECOMMENDATION** | JWT 24h demasiado largo; no es bug por sí solo |
| V-EXTRA (resend) | **BUG** | Controller llama a función inexistente → 500 |
| TEST SETUP | **BUG** (bloqueador de tests) | .env.test inexistente + globalSetup colapsa |
| `/audit/tokens/consume` sin auth | **NO CONFIRMADO** (posible modelo de cabina) | No hay suficiente evidencia del requisito de negocio; requiere confirmación |
| Diseño de candidacy documents sin endpoint | **NO CONFIRMADO** (decisión de diseño) | Modelo/table existen, ruta REST no encontrada |

---

# 18. SWIFT INTEGRATION REQUIREMENTS

Para el desarrollador Swift (sin código Swift todavía):

### Autenticación
1. **Registro** → `POST /api/auth/register`. Se crea la cuenta con rol `STUDENT` (el servicio fuerza este rol). El usuario queda `status=PENDING` hasta verificar email.
2. **Verificar email** → `POST /api/auth/verify-email` (token del correo). **No usar** `/verify-email/resend` (roto, da 500).
3. **Login** → `POST /api/auth/login`. 
   - Si `requiresTotp:false` → obtén `data.token` (JWT).
   - Si `requiresTotp:true` → guarda `data.tempToken` y haz `POST /api/auth/totp/login-verify` con `{ code }`. **Nota:** este paso devuelve solo `{ valid: true }` (no emite access token) — flujo 2FA incompleto; `NO CONFIRMADO` cómo completar la sesión 2FA.
4. **Enviar en cada petición autenticada:** header `Authorization: Bearer <JWT>`.

### Headers
- `Authorization: Bearer <JWT>` en rutas protegidas.
- `Content-Type: application/json` para body JSON.
- No es obligatorio enviar `X-Request-Id` (el servidor lo genera y lo devuelve).

### Endpoints que existen
Ver la matrix completa en §11. Incluye auth, users, organizations, academic (faculties/programs/periods/voter-registries), elections (+positions/candidate-lists/candidacies/rules), ballots (+positions/options), voting, results (certify/publish/tally/live/final/report/export), audit, notifications, platform translations, health.

### Interpretación de respuestas
- Envelope común: `{ success: boolean, message?, data?, meta? }`. Comprueba siempre `success`.
- **No hay un envelope único garantizado** — voter-registry, audit y health divergen (ver §13).
- Paginación en `meta.pagination` (o `meta` reducido en voter-registry).

### Interpretación de errores
- Errores 4xx/5xx: `{ success:false, error:{ code, message, details?, stack? }, timestamp, path }` (salvo 429, que usa cuerpos planos — §12).
- Manejables típicos: 400 (validación), 401 (token), 403 (permisos/eligibilidad/TOTP pendiente/email sin verificar), 404 (no encontrado), 409 (conflicto/doble voto/token usado), 410 (token expirado), 423 (cuenta bloqueada), 429 (rate limit).

### Endpoints que requieren autenticación
Todos los de gestión salvo los listados como públicos en §4 y la matriz.

### Endpoints que requieren roles específicos
Detallado en §4 y §11: gestión electoral (ADMIN/ELECTORAL_COMMISSION = GESTORES), usuarios/organizaciones/académico = ADMIN, etc.

### Estados que puede devolver el backend
- Usuario: `PENDING, ACTIVE, SUSPENDED, DELETED`.
- Elección: `DRAFT, SCHEDULED, OPEN, CLOSED, CERTIFIED, PUBLISHED`.
- Votación: `isSuccessful`, `completedAt` en sesiones; `status: STARTED/CAST` en respuestas de sesión/voto.

### Información que NO debe asumirse
- No asumir que el rol del JWT se actualiza al cambiar en BD (V8): tratar el rol del token como una instantánea.
- No asumir que existe endpoint `/refresh` (no existe).
- No asumir que `/verify-email/resend` funciona (roto).
- No asumir forma de claves uniforme (camelCase vs snake_case por módulo — §13).
- No asumir que la certificación funciona (V3 roto).
- No asumir cifrado de votos implementado en backend (el payload viene cifrado desde el cliente; esquema criptográfico `NO CONFIRMADO`).
- No asumir endpoints para verificación de integridad de voto (las funciones SQL existen pero no hay ruta HTTP confirmada).

---

# 19. MOBILE-SPECIFIC WARNINGS

1. **Expiración del JWT (24h):** el access token caduca a las 24h. El cliente deberá re-login; no hay endpoint `/refresh`.
2. **401 vs 403:** 
   - 401 = token ausente/expirado/inválido → re-autenticar.
   - 403 = rol insuficiente, email sin verificar, TOTP pendiente, elector no elegible. No confundir con vencimiento.
3. **423 ACCOUNT_LOCKED:** cuenta bloqueada 15 min por intentos fallidos (mensaje con placeholder `{minutes}` no sustituido — el cliente debe mostrar texto propio).
4. **429:** rate limiting por IP (global 100/15min; login 5/15min; register/password/verify 10/60min). Si la app hace polling de resultados/tallies, puede tocar el límite global → usar backoff/retry y no hacer polling agresivo.
5. **500 en endpoints rotos:** `/verify-email/resend` (siempre 500); POST/PUT candidacy en instalaciones con V2; `POST /elections/:id/certify` (V3); login/logout/voting en instalaciones con V1/V6.
6. **Endpoints dependientes de SQL que no carga:** cualquier operación que toque `refresh_tokens`, `one_time_tokens`, `login_is_allowed`/`register_*`, `candidacies` o `certify_election` en una BD construida con los scripts actuales fallará hasta corregir V1/V2/V3/V6.
7. **Respuestas no completamente definidas:** los endpoints de `/api/audit/tokens*` ya están verificados contra `audit.controller.js` (ver §5 y §11). La estructura completa de resultados `live` permanece `NO CONFIRMADO`; se recomienda verificación empírica.
8. **2FA incompleto:** tras `login-verify` no se emite access token; un flujo móvil de 2FA no puede completarse end-to-end con lo documentado.
9. **Envelope divergente:** no asumir `data`/`meta` en voter-registry, audit y health.
10. **CORS:** si la app corre en WebView/navegador, el origen debe estar permitido en `CORS_ORIGIN`; nativo no envía Origin pero el despliegue debe tolerarlo.

---

# 20. BACKEND READINESS FOR SWIFT

## HTTP/API
🟡 **READY WITH FIXES** — La capa de contratos HTTP (rutas, schemas, envelopes, errors) es estable y razonablemente confiable, pero existen envelopes divergentes y algunos endpoints en estado roto.

## Authentication
🔴 **NOT READY** — Login depende de funciones SQL que no cargan en instalación limpia (V1/V6); `/verify-email/resend` roto; flujo 2FA no emite access token final; JWT 24h sin refresh.

## Authorization
🟡 **READY WITH FIXES** — El modelo de roles (GESTORES/ADMIN) y anti-IDOR funcionan, pero el rol del JWT no se revoca al cambiar (V8).

## Database
🔴 **NOT READY** — V1 (tablas de sesión no creadas / aborto Docker), V2 (`candidacy_status_type` inexistente) y V6 (scripts desfasados) impiden construir una BD funcional limpia. Conexión como superusuario en dev (V4).

## Voting
🔴 **NOT READY** — El motor de voto (sesiones, doble voto, integridad) está bien diseñado en SQL, pero no opera en instalación limpia por V1/V6; la certificación está rota (V3).

## Testing
🔴 **NOT READY** — `globalSetup` colapsa (V6 + `.env.test` inexistente); no hay suite de integración reproducible desde instalación limpia.

## Overall
🟡 **READY WITH FIXES**

**Motivo:** la capa HTTP/contratos y la lógica modular están bien diseñadas y son estables, por lo que el contrato de API que alimenta a una app Swift es razonablemente confiable. Sin embargo, los bloqueadores confirmados (V1, V2, V3, V6, y el test setup) rompen funciones esenciales (login seguro, candidaturas, certificación) e impiden validar el flujo end-to-end real (registro → candidatura → voto → escrutinio → certificación) contra una instalación limpia. Una vez corregidos y validada una instalación limpia y los tests de integración, el backend queda 🟢.

---

# 21. REGLA PARA FUTURO DESARROLLO SWIFT

> Este documento describe el backend existente. Si el desarrollo Swift necesita un comportamiento que no esté documentado aquí, primero debe verificarse contra el backend. No se debe inventar un endpoint, campo, response, rol o flujo.
