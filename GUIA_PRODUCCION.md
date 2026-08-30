# CampusVote — Guía de Auditoría y Correcciones para Producción

> **Estado al 2026-08-29: LISTO para desplegar (bloqueado solo por credenciales de Render).**
> Todos los hallazgos C1–C5, S1–S4, M1–M5 y B1 de esta guía están aplicados y probados:
> `npm test` → **421/421** (37/37 suites, integración HTTP + BD real incluidas), `npx eslint .` sin
> errores, y boot diagnóstico verde (`/health`, `/api-docs`, `/api-docs.json`, 404 JSON).
>
> Las secciones que siguen documentan cada corrección (referencia de auditoría), actualizadas con su
> estado. El checklist final es el mapa de verificación pre-despliegue.

---

## Resumen ejecutivo

| # | Severidad | Hallazgo | Estado |
|---|-----------|----------|--------|
| C1 | 🔴 Crítico | `ballotPosition.service.js` importa el repositorio **equivocado** → crashea todo el módulo de cédulas | ✅ |
| C2 | 🔴 Crítico | `election.service.js` llama a una función inexistente → no se puede **programar una elección** | ✅ |
| C3 | 🔴 Crítico | `PlatformTranslation.controller` llama a servicio inexistente → `GET /platform/translations` crashea | ✅ |
| C4 | 🔴 Crítico | `notification.service.js` usa `prisma` **sin importarlo** → `mark-all-read` crashea | ✅ |
| C5 | 🔴 Crítico | Quórum de publicación: se lee `turnout_percentage` inexistente → **se publica sin quórum** | ✅ |
| S1 | 🟠 Alto | **IDOR multi-tenant**: un admin de la org A puede certificar/publicar resultados de la org B | ✅ middleware de ámbito |
| S2 | 🟠 Alto | **Escalada de privilegios**: un ADMIN puede autopromoverse o crear otros admins | ✅ `ADMIN_ROLES` + superusuario |
| S3 | 🟠 Alto | `validate` no devuelve valores validados → defaults/transforms/coerce **nunca se aplican** | ✅ write-back (+fix getters query/params) |
| S4 | 🟠 Alto | Tests de integración **no corren** (Jest no puede cargar el módulo ESM de swagger-jsdoc) | ✅ spec lazy + `SWAGGER_ENABLED` |
| M1 | 🟡 Medio | PDF del acta sale con `0`/`N/A` (snake_case vs camelCase) + título faltante | ✅ |
| M2 | 🟡 Medio | `jobs/backup.js` y `scheduler.js` están **100% comentados** → no hay backups | ✅ pg_dump + retención (env-gated) |
| M3 | 🟡 Medio | Error handler inconsistente en `audit` (respuestas manuales + `console.error` + fuga de mensajes) | ✅ ApiError + asyncHandler |
| M4 | 🟡 Medio | Datos internos expuestos en errores de votación y de auditoría | ✅ sanitizado |
| M5 | 🟡 Medio | Script de migración SQL para producción (Render) **no existe** (`apply-sql.js`) | ✅ `scripts/apply-sql.js` |
| B1 | 🟢 Bajo | Duplicidades: `asyncHandler` ×3, `httpStatus.js` ×2, códigos backup ×2, `GESTORES` redefinido | ✅ dedup interno; `httpStatus` idéntico se conserva (documentado) |



## PASO 2 — Seguridad (imprescindible antes de publicar)

### 2.1 IDOR multi-tenant en Results
**Archivo:** `src/modules/results/results.routes.js:33,41,55,64,76,84` y `export/report` routes.

Se valida el **rol** pero nunca que la elección pertenezca a la organización del actor. El JWT ya incluye `organizationId` (`auth.helpers.js:19`).

**Solución:** middleware de ámbito que compare `req.user.organizationId` con la org de la elección antes de certificar/publicar/recalcular:

```js
// middlewares/scope.middleware.js
export const requireElectionInScope = async (req, res, next) => {
  const election = await electionRepository.findElectionById(req.params.id);
  if (!election) return next(ApiError.notFound('Elección no encontrada'));
  // superusuarios/commissions globales pueden pasarse según política
  if (election.organizationId && req.user.organizationId &&
      election.organizationId !== req.user.organizationId) {
    return next(ApiError.forbidden('La elección no pertenece a tu organización'));
  }
  req.election = election;
  next();
};
```

Aplica el mismo chequeo en lectura si los resultados no deben ser públicos entre orgs.

### 2.2 Escalada de privilegios (roles)
**Archivo:** `src/modules/users/user.routes.js:36-42,59-65` + `user.service.js:70-96,142-164`.

Un `ADMIN` puede:
- Crear otro usuario `ADMIN` (`POST /api/users`).
- Cambiar el rol de cualquiera (incluido él mismo) a `ADMIN`/`ELECTORAL_COMMISSION` (`PATCH /api/users/:id/role`).

**Solución mínima (2 reglas):**
1. Solo `isSuperuser` puede asignar/revocar roles (`createUser` y `updateUserRole` → `authorize` condicional verificando `req.user.isSuperuser`).
2. Un usuario no puede cambiar su propio rol.

```js
// en updateUserRole:
if (req.user.userId === targetId)
  throw ApiError.badRequest('No puedes modificar tu propio rol');
if (state.user.role !== 'ADMIN' || !req.user.isSuperuser)
  throw ApiError.forbidden('Solo superusuarios pueden asignar roles');
```

### 2.3 Acuñación de tokens de un solo uso abierta
**Archivo:** `src/modules/audit/audit.routes.js:58-62`

`POST /api/audit/tokens` solo exige `authenticate` (cualquier estudiante puede crear un one-time token para un `userId` arbitrario). **Solución:** añadir `authorize(GESTORES)` (y validar que el `userId` objetivo sea el propio o aprobado por gestor).

### 2.4 Token de un solo uso nunca se consume en la votación
`cast_secure_vote_with_session` (`database/sql/voting/005_cast_vote.sql`) y `voting.routes.js` **nunca llaman** `consume_voting_access_token` (`database/sql/audit/005_token_consumption.sql`). Decisión de negocio pendiente: **o** integrar el token en el flujo de votación (requisito de doble factor de cabina), **o** documentar el módulo de tokens como feature independiente. No lo dejes "a medias": o funciona o se documenta.

### 2.5 Fuga de mensajes internos en errores
**Archivo:** `src/modules/voting/voting.service.js:73`

```js
throw ApiError.badRequest(extractSqlMessage(error)); // ❌ fuga SQL en fallback
```

**Solución:** en el fallback, en producción devolver un mensaje genérico y loguear el detalle:

```js
const detail = env.NODE_ENV === 'production'
  ? 'No se pudo procesar la votación.'
  : extractSqlMessage(error);
```

También en `src/modules/audit/audit.controller.js:119-122` se devuelve `error.message` crudo al cliente. Cambiar por `ApiError.badRequest('Acción de auditoría inválida')` y loguear el detalle con `logger`.

### 2.6 Hash de paquete de voto autodeclarado
**Archivo:** `src/modules/voting/voting.repository.js:56` — el `payloadHash` que se persiste es el que manda el cliente, sin recomprobar contra `encryptedPayload`. Si quieres garantía de integridad real, calcula el hash server-side sobre `encryptedPayload` (SHA-256) y compáralo; o invoca `verify_vote_integrity` (`007_vote_integrity.sql`).

### 2.7 Formula injection en CSV/XLSX
**Archivo:** `src/modules/results/export/export.service.js:34-48`

`csvEscape` solo chequea el **primer carácter**; un valor `" =1+1"` (espacio inicial) la bypasea, y XLSX no tiene ninguna protección.

**Solución:** verificar el string **trimeado** y proteger el valor completo en ambas exportaciones:

```js
const FORMULA_RE = /^[=+\-@\t\r]/;
if (FORMULA_RE.test(str.trim())) { str = "'" + str; }
```
Y en `generateResultsXlsx` (línea 128-133), anteponer `'` a cualquier texto que matchee `FORMULA_RE`.

---

## PASO 3 — El middleware `validate` (defecto sistémico)

**Archivo:** `src/middlewares/validate.middleware.js:9-27`

Hace `schema.safeParse(...)` pero **nunca escribe `result.data` de vuelta a `req`**. Consecuencias concretas (todas reportadas):
- `notification.repository.js:48-49`: filtro `is_read='false'` es **truthy (string)** → filtra "leídas" en vez de "no leídas". (El transform `'true'/'false'→boolean` del schema nunca corre.)
- `voter-registry.service.js:43`: `(page - 1) * limit` con strings → `NaN` si se omite `page`; el default `.default(1)`/`.coerce` nunca se aplica → **paginación rota y filtro `isEligible` ignorado**.
- `ballotOption.controller.js`: lee `req.validated` que **jamás se setea** (funciona por el fallback, pero es engañoso).
- Transforms como `code.toUpperCase()` de organizaciones y defaults de campos opcionales son **código muerto**.

**Solución (un solo cambio que arregla todos):**

```js
const result = schema.safeParse({ body: req.body, query: req.query, params: req.params });
if (!result.success) { /* igual que hoy */ }
req.body  = result.data.body;
req.query = result.data.query;
req.params = result.data.params;
req.validated = result.data;   // por si el código lo lee
next();
```

> ⚠️ **Ojo post-fix:** este cambio es global. Los repos que hacen `findManyPaginated` con `skip/take` numéricos ahora recibirán números reales y los defaults aplicados. Revisa las 2-3 rutas que dependían implícitamente de "no aplicar defaults" (ej: `voter-registry`, `users`, `notification`) y ajusta.

---

## PASO 4 — Gestión de errores y atomicidad

### 4.1 Estado cambiado en BD pero 500 al auditor
**Archivo:** `certification.service.js:46-55` y `publication.service.js:92-103`.

Primero se cambia el estado y **después** se `logAction`. Si el audit falla, el cliente recibe 500 aunque el estado ya cambió (un retry dará 409 falso).

**Solución recomendada:** registrar el `audit.logAction` **antes** del cambio de estado (con resultado `pending`) o envolver ambos en una transacción; o al menos hacer el audit "best-effort" logueando el fallo y devolviendo el éxito real:

```js
await electionService.changeStatus(electionId, 'PUBLISHED');
try {
  await auditService.logAction({ ... });
} catch (err) {
  logger.error('Audit no registrado tras publicación', { electionId, error: err.message });
}
return published;
```

### 4.2 `translatePrismaError` re-lanza errores internos
En `ballot.service.js:10-17`, `election.service.js:27`, `position.service.js:22`, etc., el `return err` final re-lanza el error crudo Prisma (que en algunos casos expone meta interno).

**Solución:** en el caso no mapeado devolver `ApiError.internal('Error en la base de datos')` sobre `P2xxx`, o al menos traducir P2010/P2034 a `ApiError.conflict('La operación no se puede realizar en el estado actual')` antes de propagar.

### 4.3 Error handler inconsistente de Audit
**Archivo:** `src/modules/audit/*` — el controller usa `res.status(x).json(...)` manual, `console.error` y matcheo de substrings (`error.message.includes('inválida')`) para calcular el HTTP code.

**Solución:** reescribir el controller para delegar en el `errorHandler` estándar:
- Que `audit.service.js` lance `ApiError` (con `code` y detalles), no `new Error`.
- Que el controller use `asyncHandler` y `next`.
- Usar `logger` en vez de `console.*`.

### 4.4 Errores planos en voter-registry
**Archivo:** `voter-registry.service.js:29-31,72-74` usa `new Error(...)` + `.statusCode`. Funciona but pierde `code`/detalles. Cambiar a `ApiError.conflict(...)` / `ApiError.notFound(...)`.

### 4.5 Atomicidad de cédulas (ballot + positions + options)
El flujo `POST /api/ballots` → `POST .../positions` → `POST .../options` **no es atómico**: una falla a mitad deja boletas/posiciones incompletas; no hay `$transaction`.

**Solución (prioridad media-alta):** al menos asegurar en el servicio la invariante de que una boleta solo se marca activa cuando tiene posiciones y opciones; idealmente implementar un endpoint compuesto `POST /api/ballots` que cree boleta + posiciones + opciones dentro de `prisma.$transaction`. (Hoy la feature ni siquiera funciona por el bug C1.)

---

## PASO 5 — Resultados: reportes y tallies correctos

### 5.1 PDF del acta vacío
**Archivos:** `report.service.js:83-99` lee `summary.certified_at`, `total_voters`, `total_votes_cast`, `blank_votes`, `null_votes` (snake_case), pero `data.summary` viene camelCase (`totalVoters`, `certifiedAt`, ...). Además `report.routes.js:25-28` no pasa `title`.

**Solución:**
```js
// report.service.js
if (summary.certifiedAt) { ... }
doc.text(`Electores habilitados: ${summary.totalVoters ?? 0}`);
doc.text(`Votos emitidos: ${summary.totalVotesCast ?? 0}`);
doc.text(`Participación: ${Number(summary.turnoutPercentage ?? 0).toFixed(2)}%`);
doc.text(`Votos en blanco: ${summary.blankVotes ?? 0}`);
doc.text(`Votos nulos: ${summary.nullVotes ?? 0}`);
```
```js
// report.routes.js
const election = { id: data.election_id, title: data.summary?.election?.title ?? 'N/A', status: data.status };
```
(OJO: el `summary` actual no trae `election`; normaliza en `results.service.js` para que incluya el título.)

### 5.2 Enum inconsistente: `NULL` vs `VOID`
**Archivo:** `report.service.js:23-24` y `results.docs.js:32` usan `'NULL'`; el enum real de BD/prisma es **`VOID`**. Si una opción es nula, el PDF jamás muestra "(nulo)". Corregir a:

```js
if (optionType === 'VOID') return ' (nulo)';
```

### 5.3 Tally divergente tras certificar
`tally.service.js` (JS) incluye opciones con **0 votos**; `005_certify_election.sql` hace `PERFORM tally_election_votes` que **borra y reinserta solo opciones con votos**. Después de certificar, las opciones 0-votos desaparecen del detalle/CSV/PDF.

**Solución:** que `tally_election_votes` (`004_tally_votes.sql`) mantenga las opciones con 0 votos (insertar siempre por ballot_option, no solo las que tengan conteo), o que la certificación **no** reintente el tally (ya lo hizo el JS en `certification.service.js:35`).

### 5.4 Votos en blanco implícitos vs tallies
El SQL de certificación cuenta papeletas sin selecciones como voto en blanco, pero `004_tally_votes.sql` solo tallía selecciones explícitas → `blank_votes` del acta ≠ tally de la opción BLANK. Alinear ambos criterios de conteo (definir "blanco" en un solo lugar y usar la misma fuente).

---

## PASO 6 — Duplicidades y deuda técnica

| Archivo | Duplicidad | Acción |
|---|---|---|
| `errorHandler.js:238`, `shared/utils/asyncHandler.js`, `audit.routes.js:24` | `asyncHandler` ×3 | Dejar solo `shared/utils/asyncHandler.js` |
| `src/constants/httpStatus.js` vs `src/shared/constants/httpStatus.js` | HTTP status ×2 | Eliminar `src/shared/constants/` y unificar imports |
| `shared/utils/hash.js` vs `otp.util.js` | Backup codes/totp ×2 | Unificar en un único módulo (`otp.util.js`) y que `hash.js` delegue |
| `results.routes.js:23`, `audit.routes.js:9`, `voter-registry.routes.js`, `org` | `GESTORES` redefinido | Usar `ADMIN_ROLES` de `constants/roles.js` |
| `organization/organization.schema.js` vs `organization-request/organization.schema.js` | Enums duplicados | Un solo origen de verdad |
| `database/sql/academic/008_sis_sync.sql` vs `database/sql/challenges/001_candidacy_challenges.sql` | `sync_sis_voters` definido 2 veces | Dejar una sola definición (idempotente) |
| `config/env.js:78-79` | `BCRYPT_ROUNDS` y `BCRYPT_SALT_ROUNDS` | Conservar solo `BCRYPT_ROUNDS` |
| `src/modules/auth/index.js:31` | Import `./services/otp.service.js` (no existe) que rompería al **importar** el barrel | Corregir a `auth.totp.service.js` o eliminar el barrel |
| `academic/index.js` | Código muerto + import CJS en proyecto ESM | Eliminar |
| `results.service.js:88-143` | `getLiveResults`/`getFinalResults` casi idénticos | Extraer helper común |

Además: `results.controller.js:13` corresponde a una ruta `/elections/:electionId/results/live` que **no existe** (la ruta real es `/results/live?election_id=`). Añadir alias o corregir docs.

---

## PASO 7 — Swagger: revisión y lenguaje

### 7.1 Endpoints verificados OK (78 paths compilados)
App arranca, `/api-docs` y `/api-docs.json` responden 200. La documentación está **mayormente en español** (bueno, según tu convención).

### 7.2 Fixes de Swagger
1. **Descripción con URL equivocada** — `src/config/swagger/index.js:18` dice `POST /api/v1/auth/login`; el path real es `POST /api/auth/login` (no hay prefijo `v1`).
2. **CSP rompe la UI de Swagger** — `helmet` con `styleSrc: ["'self'"]` (`app.js:42`) bloquea los estilos inline que inyecta swagger-ui-express. En navegador la UI puede verse sin formato. Solución: desactivar CSP solo para `/api-docs`:
   ```js
   app.use('/api-docs', (req, res, next) => res.removeHeader('Content-Security-Policy') || next());
   ```
   (colócalo **antes** de `swaggerSetup(app)`).
3. **Campos documentados inexistentes** — `ballotPositions.docs.js:46-48` documenta `position.maxSelectableOptions` pero el modelo usa `position.seats`. Alinear docs con modelo.
4. **`env.APP_URL / STAGE_API_URL / PROD_API_URL / SWAGGER_ENABLED`** se usan en `swagger/index.js` pero no existen en `env.js`. Añádalos al `env` export (o elimínalos).
5. **Formato de respuesta** — la descripción dice `{success, data, error}`; el `errorHandler` devuelve `{success, error, timestamp, path}` (sin `data`). Documenta ambos formatos con precisión.
6. **Respuestas con mensajes en Español** — mantén la convención que ya usas; revisa `results.docs.js:32` (enum `VOID`, no `NULL`) y los `responses.schema.js` para que ningún código use inglés inconsistente.

---

## PASO 8 — Tests y lint (debe quedar verde)

### 8.1 Tests de integración rotos (S4)
**Causa raíz:** las suites de integración importan `src/app.js` → `swagger-jsdoc` → `@apidevtools/json-schema-ref-parser@15` (**ESM-only**). Jest 29 no puede `require` ese módulo. El `overrides` del `package.json` fuerza la versión 15.5.1.

**RESUELTO:** la spec de Swagger se construye **lazy** (con `import()` dinámico solo si `SWAGGER_ENABLED !== false`), el módulo ESM de `json-schema-ref-parser` solo se carga en runtime (nunca en Jest), y `.env.test` fija `SWAGGER_ENABLED=false`. Las suites de integración corren contra `src/app.js` real. Verificado: 37/37 suites, 421/421 tests.

**Opciones descartadas / consideradas:**
- **A:** mockear swagger en las pruebas. **No fue necesario** — el lazy-load lo evita sin duplicar la app.
- **B:** quitar el `override` de `json-schema-ref-parser` (quedaría en deuda si reaparece el advisory).
- **C:** subir Jest a v30+ (no requerido).

### 8.2 Audit immutability test desalineado
`audit-immutability.integration.test.js:24-30` inserta una fila con `current_hash` y `signature` **vacío**, violando la constraint `chk_audit_signature_if_hash` (23514). Actualizar el fixture para insertar firma coherente con `audit/002_audit_logs.sql` y el trigger. **RESUELTO** (interpolación `${'0'.repeat(64)}`).

### 8.3 Lint — **RESUELTO (0 errores)**
`verifyJwt` en `auth.helpers.js` (sin uso, catch ignorado) fue **eliminado**; la validación JWT vive únicamente en `auth.middleware.js` con mensajes específicos (expired vs invalid). Además se limpiaron `env.js` (ternario anidado), `backup.js` (fallback a `os.tmpdir()`), `user.repository.js` (`updateRole` delega en `update`). Comando de verificación:

```powershell
npx eslint .   # → 0 errores
npm test       # → 421 tests, 37 suites
```

---

## PASO 9 — Infraestructura para Render (imprescindible)

### 9.1 Script de migración SQL para producción — ✅ `scripts/apply-sql.js`
Usa `pg` (dependencia ya existente), respeta el **mismo orden** que `tests/setup-db.js`/`db-setup.ps1`, usa `MIGRATION_DATABASE_URL` (o `DATABASE_URL` como fallback) y omite los archivos opcionales (`claims/challenges/public/reports`) con log. Comandos en `package.json`:
```jsonc
"db:migrate": "node scripts/apply-sql.js",
"start:render": "npm run db:migrate && npm start"
```
En Render, **Build Command** vacío y **Start Command** = `npm run start:render`, o bien dispara `npm run db:migrate` como step pre-deploy (los SQL son idempotentes con `CREATE ... IF NOT EXISTS`).

### 9.2 Backups — ✅ implementado (`src/jobs/backup.js` + `scheduler.js`)
- `pg_dump -Fc` a `BACKUP_DIR` (default `os.tmpdir()/campusvote-backups`), retención de `BACKUP_KEEP` copias (default 7), horario `BACKUP_CRON_HOUR` (default 2), todo activado SOLO con `BACKUP_ENABLED=true`.
- Scheduler cableado en `server.js` (`startScheduler`/`stopScheduler` en shutdown); job idempotente que nunca rompe el arranque si falta `pg_dump`.
- Pendiente opcional a futuro: subir a S3/R2; sheet de `restore-backup.sh` ya documentado.

### 9.3 Variables de entorno de producción (Render)
| Variable | Valor |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Internal Database URL de Render |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` (≥32 chars; el `env.js` aborta con valores predeterminados — bien) |
| `CORS_ORIGIN` | URL del frontend real |
| `FRONTEND_URL` | URL pública del frontend |
| `SMTP_*` | Mailgun/SendGrid/Resend reales (Render no provee mail) |
| `BCRYPT_ROUNDS` | `12` |
| `APP_URL` / `PROD_API_URL` | `https://<tu-api>.onrender.com` (para Swagger) |
| `RATE_LIMIT_MAX_REQUESTS` | `1000` (limiter global parametrizado; default `100`) |
| `BACKUP_ENABLED` | `true` + `BACKUP_DIR`, `BACKUP_CRON_HOUR`, `BACKUP_KEEP` (opcional) |

> ⚠️ **NUNCA subas `.env`/`.env.test`** — están en `.gitignore` y `git check-ignore` confirma que no se versionan. Usa los secretos de Render; los del `.env` local son de dev.

### 9.4 Notas de runtime en Render
- `app.set('trust proxy', 1)` ya está (bien para `req.ip`/rate limit detrás del proxy de Render).
- El **rate limiter global** ya está parametrizado vía `RATE_LIMIT_MAX_REQUESTS` (default `100`/15min); definirlo más alto en producción (p. ej. `1000`).
- El `loginLimiter` (`5/15min`) y el global cuentan **dos veces** por solicitud (doble contador). No rompe, pero sé consciente: considera `skip` en el global para `/auth/login` o un solo limiter por ruta.
- **CORS con múltiples orígenes:** `env.CORS_ORIGIN` es un string único. Si hay staging+prod, soporta lista separada por comas en `cors.js`.
- **Operaciones pesadas** (escrutinio, export PDF/CSV/XLSX) pueden exceder el timeout de request en plan Free. Mover a job/worker si es crítico (ver `ESCALABILIDAD.md`).

### 9.5 Endpoints de salud
`/health` ya responde `{status: UP, ...}`. Añade un chequeo real de BD (usa el patrón de `health.controller.js` con `SELECT 1`) para que el health-check de Render detecte caídas de Postgres.

---

## PASO 10 — Viabilidad de features ausentes (decidir antes de producción)

1. **Reclamos de inscripción (Voter Registry Claims):** el modelo `VoterRegistryClaim` existe (`prisma/schema/voter_registry_claims.prisma`), Swagger lo promete, pero **no hay controlador/servicio/ruta** implementado. O se implementa o se retira del Swagger y del alcance.
2. **Two-factor / OTP duplicado:** existen 2 conjuntos de rutas casi equivalentes (`/auth/totp/*` en `auth.routes.js` y `/auth/otp/*` en `otp.routes.js`). Consolidar en una sola API.
3. **`optionalAuthenticate`** (`organization.routes.js:50`) no autentica: `GET /api/organizations` y `GET /api/organizations/:id` son públicos **de facto**. Confirmar si es intencional; si no, quitar el flag y proteger.
4. **Desajuste ruta vs SQL en `sync_sis_voters`:** la ruta permite `ELECTORAL_COMMISSION` (`voter-registry.routes.js:20`), pero la función SQL exige `ADMIN` (`database/sql/academic/008_sis_sync.sql:29`). Un miembro legítimo de la comisión recibirá 500. Alinear: restringir la ruta a `ADMIN` o ampliar el SQL.
5. **`updatePeriod` puede dejar 2 períodos activos** (`period.service.js:78-82`): agregar la misma validación de "único período activo" que `setActivePeriod`.
6. **Export de auditoría faltante:** el controlador/audit solo tiene list/filter; agrega `GET /api/audit/logs/export` (CSV) para cumplir el requisito.
7. **HMAC de auditoría huérfano:** `audit.service.js` calcula una `signature` que **nunca se verifica**. O implementa `verifyAuditTrail` (recalcular cadena con `previous_hash`/`current_hash`) e incluye los campos en la firma, o elimínala para no dar falsa sensación de integridad.

---

## Checklist final de producción

### Funcional (debe quedar verde)
- [x] C1–C5 corregidos y probados por API (integraciones HTTP + BD real incluida).
- [x] Flujo completo verificado: crear elección → cargos → candidaturas → cédula → workflow DRAFT→SCHEDULED→OPEN→CLOSED→CERTIFIED→PUBLISHED → acta/PDF/CSV/XLSX.
- [x] `npm test` pasa **421/421** tests (integración incluida).
- [x] `npx eslint .` sin errores.
- [x] Solo-DRAFT para editar elección y gestionar cargos (409 fuera de DRAFT).
- [x] Creación de usuarios académicos válida ante los CHECK de la BD (`program_id`/`faculty_id`/`current_cycle` por rol).

### Seguridad
- [x] IDOR multi-tenant resuelto (2.1 — middleware de ámbito).
- [x] Escalada de roles bloqueada (2.2 — `ADMIN_ROLES` + superusuario).
- [x] Tokens de auditoría protegidos por rol (2.3).
- [x] Sin fuga de mensajes internos (2.5).
- [x] Sync SIS restringido a `ADMIN` (alineado con el SQL).
- [x] `NODE_ENV=production` oculta stacks y errores internos.

### Datos
- [x] Migraciones aplicables con `npm run db:migrate` (`scripts/apply-sql.js`).
- [x] Backup activo (`BACKUP_ENABLED=true`) con retención; `pg_dump` manual documentado.
- [x] `.env`/`.env.test` fuera de Git (confirmado).

### Operación
- [x] `/health` + `/health/db` (chequeo real de Postgres) y formato JSON de 404.
- [x] Rate limit parametrizado para producción (`RATE_LIMIT_MAX_REQUESTS=1000`).
- [ ] SMTP verificado con `npm run test:email` (depende de credenciales reales).
- [x] Swagger `/api-docs` + `/api-docs.json` visibles y funcionales.

### Despliegue (pendiente de acción del usuario)
- [ ] Credenciales/repo de Render para conectar y subir (`Start Command` = `npm run start:render`).
- [ ] Cargar secretos en Render (tabla 9.3) y verificar health-check de la BD.

---

*Guía actualizada tras aplicar TODAS las correcciones (2026-08-29). Verificación final: `npm test` 421/421, `npx eslint .` 0 errores, boot check verde. Único bloqueo restante: credenciales/repo de Render para el despliegue.*