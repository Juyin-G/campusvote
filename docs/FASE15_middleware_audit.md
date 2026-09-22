# FASE 15.2 — Auditoría de Middlewares y Estrategia de Protección Multi-Tenant

> **Fecha:** 2026-09-22 · **Base de referencia:** FASE 15.1 (matriz de rutas/tablas).
> **NOTA DE RUTAS:** Los middlewares viven en **`src/middlewares/`** (plural). No existe `src/middleware/`.

---

## 1. Tarea 1 — Análisis de Middlewares Existentes (línea por línea)

### 1.1 `src/middlewares/auth.middleware.js`

| Export | Líneas | Qué hace | Extrae de `req` | Código de error |
|---|---|---|---|---|
| `authenticate` | 21-72 | Lee `Authorization: Bearer` **o** cookie `campusvote_access` (§23-27). Verifica JWT con `algorithms: ['HS256']` (§43). Rechaza tokens con `purpose` ∈ `TOTP_PENDING`/`ONBOARDING` (§47-53). Asigna al payload decodificado en `req.user` (§55). | `req.user.organizationId` (viene del payload del token; el token lo emite `auth.helpers.js` con el org del user) | 401 (sin/válido inválido §70), 401 invalidToken (§60,66), 403 para tokens de propósito limitado (§49) |
| `authenticateToken` | 84 | Alias de `authenticate` (retrocompat) | idem | idem |
| `authenticateAllowPending` | 90 | Permite `purpose=TOTP_PENDING`/`ONBOARDING` (flujo login/onboarding) | idem | idem |
| `requireTotpPending` | 95-107 | Exige token `purpose=TOTP_PENDING` | — | 401 sin user / 403 wrong purpose |
| `requireOnboarding` | 112-124 | Exige token `purpose=ONBOARDING` | — | idem |
| `authorizeTenant(roles)` | 131-155 | Guardia de rol para rutas de **negocio/tenant**. Sin validación de `organizationId`. Avisa en consola si recibe `SUPERADMIN` (§138-145) | `req.user.role` | 401 sin user / 403 rol no permitido |
| `authorizeRoles` | 162 | Alias de `authorizeTenant` | idem | idem |
| `authorizePlatform(roles)` | 169-183 | Guardia de rol para rutas **macro/plataforma** (aquí es válido SUPERADMIN) | `req.user.role` | 401 / 403 |
| `authorize(roles)` | 192-202 | Delega en `authorizeTenant`. **Emite `console.warn` si el array incluye `SUPERADMIN`** (§193-200) — es decir, `authorize(SUPERADMIN)` dispara warning en desarrollo | `req.user.role` | 401 / 403 |

**Brecha:** Ninguno de estos middlewares valida `organizationId`, ni pertenencia del recurso al tenant. `authorize()` es "rol-only".

---

### 1.2 `src/middlewares/platformBoundary.middleware.js`

| Export | Líneas | Qué hace | Error |
|---|---|---|---|
| `blockSuperAdminFromTenantRoutes` | 27-56 | Se monta **globalmente sobre `tenantRouter`** (`routes/index.js:92`). Si `req.user.role === SUPERADMIN` → registra auditoría `TENANT_ACCESS_VIOLATION` (§37-48) y responde 403 (§53-55). Todo actor no-SUPERADMIN pasa directo (§32-34). | 403 |

**Implicación crítica para el mapa:** cualquier ruta bajo `tenantRouter` (`/academic`, `/audit`, `/fairs`, `/users`, `/notifications`, `/upload`, `/admin`, `/certificates`, `/projects`) **rechaza a SUPERADMIN antes de llegar a cualquier authorize()**. Por tanto:
- Los `authorize(ADMIN, SUPERADMIN)` de `career.routes`/`course.routes`/`teachingEvaluation.routes` tienen la opción SUPERADMIN **muerta** (nunca llega).
- Toda decisión “permitir SUPERADMIN aquí” (ver C3 `/audit/verify` y C6) exige **sacar la ruta del `tenantRouter`**.

---

### 1.3 `src/middlewares/tenantScope.middleware.js`

| Export | Líneas | Qué hace | Error |
|---|---|---|---|
| `canActorActOnUser` | 60-115 | Valida (1) mismo `organizationId`, (2) scope SITE/REGION del actor vs sedes del target. SUPERADMIN → 403 (§63-69). | 403 |
| `requireActorCanActOnUser(paramName)` | 124-164 | Factory middleware: carga `user.findUnique({id})` + `siteAssignments`, llama `canActorActOnUser`, cachea `req.targetUser`. | 400 si falta param, 404 si no existe, 403 scope |
| `buildScopeUserWhere(actor)` | 174-208 | Construye `where` de Prisma para User con org + scope (ORG→null, REGION→`siteAssignments.some(site.regionId)`, SITE→`siteId in accesibles`). Rechaza SUPERADMIN (§175-180). | 403 |
| `attachScopeUserFilter` | 214-223 | Aplica `buildScopeUserWhere` y lo deja en `req.scope.userWhere`. Solo lo consume `user.routes.js:84` (GET /users) y `adminScope.routes.js:86`. | 403 |

**Brecha:** Cubre únicamente el CRUD de usuarios y el módulo adminScope. **No se aplica a ningún server de FERIAS/académico.**

---

### 1.4 `src/middlewares/scope.middleware.js`

| Export | Líneas | Qué hace | Error |
|---|---|---|---|
| `requireFairInScope` | 62-94 | Carga `fairRepository.findById(fairId)` (§70), rechaza actor sin `organizationId` con auditoría `ACCESS_DENIED` (§76-82), compara `fair.organizationId !== actor.organizationId` → 403 + log (§84-87). Cachea `req.fair`. Lee param `req.params.id \|\| req.params.fairId`. | 400 sin fair_id, 404, 403 |
| `requireProjectInScope` | 96-130 | Carga `project.findUnique({id})` select org+fair (§104-107), mismo patrón de tenant. Cachea `req.project`. Lee param `req.params.id \|\| req.params.projectId`. | 400/404/403 |

**Brecha (C7):** Ambos están **definidos pero montados en CERO rutas** (grep global = 0 usos). Además `requireFairInScope`/`requireProjectInScope` invocan `auditService.logAction`, que escribe en `audit_logs` (queries extra en cada request).

---

### 1.5 `src/middlewares/validate.middleware.js` y `rateLimiter.middleware.js`

- `validate(schema, source)` (§objetivo): valida `body/query/params` con Zod → 400. No toca tenant.
- `authLimiter`/`loginLimiter`: rate-limit → 429. No toca tenant.

---

### 1.6 `src/middlewares/upload.middleware.js`

Multer. Solo parsea multipart. No toca tenant.

---

## 2. Tarea 2 — Mapa de Correcciones de Rutas (C1–C7)

> Escenario objetivo = **doble capa**: ① middleware de scope en la ruta + ② guard `assertTenantMatch` opcional en el service (FASE 15.3). El middleware cierra el agujero; el guard de service da profundidad.

### Grupo 1 — C1 · FairEngagement (8 rutas, hoy sin tenant-scope)

Archivo: `src/modules/fairEngagement/fairEngagement.routes.js`

| Ruta | Middleware a montar | Nota |
|---|---|---|
| `POST /:fairId/projects/:projectId/like` | `requireProjectInScope` (lee `:projectId`) | JURY same-org por invariancia → pasa |
| `DELETE /:fairId/projects/:projectId/like` | `requireProjectInScope` | idem |
| `GET /:fairId/projects/:projectId/likes/count` | `requireProjectInScope` | **cierra fuga de counts cross-tenant** |
| `GET /:fairId/projects/:projectId/engagement` | `requireProjectInScope` | **cierra ADMIN de cualquier org** |
| `POST /:fairId/projects/:projectId/comments` | `requireProjectInScope` | idem |
| `GET /:fairId/projects/:projectId/comments` | `requireProjectInScope` | **cierra lectura de autores cross-tenant** |
| `PATCH /:fairId/comments/:commentId` | `requireFairInScope` (solo hay `:fairId`) | no hay `projectId` en la ruta → validar vía fair |
| `DELETE /:fairId/comments/:commentId` | `requireFairInScope` | **cierra borrado cross-tenant** |

Service guard adicional (FASE 15.3): `assertTenantMatch(actor, project, 'Project')` en `likes.service`/`comments.service`/`student.service`.

### Grupo 2 — C2 · Catálogos académicos (tablas globales)

| Ruta | Middleware / acción |
|---|---|
| `GET/POST/PUT/DELETE /api/academic/periods` (+ `/active`) | **Migración de BD requerida** (ver §4). `academic_periods` no tiene `organization_id` ni FK a org. Hasta entonces, proteger con `requireAcademicTenantScope` (nuevo) que exige `actor.organizationId` y persiste `req.organizationId`, + filtros en service (15.3). |
| `GET/POST/PATCH/DELETE /api/academic/voter-registries` (+ `/sync-sis`) | Aislable **sin migración** vía JOIN `voter_registries.user_id → users.organization_id`. Service debe filtrar por `user: { organizationId }`. Middleware: `requireAcademicTenantScope`. |
| `GET/POST/PUT/DELETE /api/academic/faculties` y `/programs` | ✅ **DECIDIDO (Q1 v2): TENANT-SCOPED**. Se agregará `organization_id` vía migración (fase de refactor BD). Hasta entonces: `requireAcademicTenantScope` (exige org) + nota de riesgo residual. La Organización A no podrá mutar el catálogo que ve B. |

### Grupo 3 — C3 · Audit Logs

| Ruta | Acción |
|---|---|
| `GET /api/audit/logs/:id` | Service guard (15.3): cargar log con `actor.user.organizationId`; si `!== actor.organizationId` → 403. |
| `GET /api/audit/verify` | ✅ **DECIDIDO (Q3): mover a router PLATFORM.** Montar `GET /api/platform/audit/verify` con `authorizePlatform(SUPERADMIN)` fuera del `tenantRouter` (`routes/index.js:126`). La frontera `blockSuperAdminFromTenantRoutes` deja de bloquearla. |

### Grupo 4 — C4 · Notifications (escritura cross-tenant)

| Ruta | Acción |
|---|---|
| `POST /api/notifications` | Service guard (15.3): `user.findUnique({ id: body.user_id }, { organizationId })`; si `target.organizationId !== actor.organizationId` → 403. |

### Grupo 5 — C5 · Organization Onboarding

| Ruta | Acción |
|---|---|
| `PATCH /api/organizations/:id/onboarding` | Service guard (15.3): `assertTenantMatch(actor, { organizationId: req.params.id }, 'Organization')` en `organization.service.js:210`. |
| `POST /api/organizations/:id/onboarding/complete` | idem en `:235`. |

### Grupo 6 — C6 · Platform Translations

Archivo: `src/modules/PlatformTranslation/PlatformTranslation.routes.js`. Las rutas viven en el router PLATFORM (`routes/index.js:78`, sin boundary), así que **SÍ pueden** recibir SUPERADMIN.

| Ruta | Acción |
|---|---|
| `GET /dictionary` | Mantener **público** (diccionario de UI; sin datos privados). |
| `GET /effective-locale/:userId` | Cambiar `authorize(ADMIN_ONLY)` → `authorizePlatform(SUPERADMIN)` (línea 31). |
| `GET /`, `GET /:id`, `POST /`, `PATCH /:id`, `DELETE /` | Cambiar `authorize(ADMIN_ONLY)` → `authorizePlatform(SUPERADMIN)` (líneas 39,47,55,63,67). |

> Usar **`authorizePlatform`** y **no `authorize`** para no disparar el `console.warn` de auth.middleware.js:193.

### Grupo 7 — C7 · Defensa en profundidad en FERIAS

Montar `requireFairInScope`/`requireProjectInScope` en los routers que gestionan recursos de feria. Estos middlewares además **rechazan SUPERADMIN** (requieren `actor.organizationId`), consistente con la frontera.

| Router | Rutas a proteger con `requireFairInScope` |
|---|---|
| `fair.routes.js` | `GET/PUT/:id`, `POST/:id/status` |
| `fairVoting.routes.js` | `POST/:fairId/votes`, `GET/:fairId/voting/{status,results}` (no `verify/:receiptCode`, es público) |
| `fairEvaluation.routes.js` | `GET/POST/PUT/:id/rubric*`, `/:id/projects*`, `/:id/evaluations`, `/:id/jury/declaration*`, `/my-progress/:fairId` |
| `fairResult.routes.js` | `GET/:id/results`, `POST/:id/results/publish`, `/:id/projects/:projectId` |
| `fairCategory.routes.js`, `fairStand.routes.js` | `/:id/categories*`, `/:id/stands*` |
| `juryAssignment.routes.js` | `/:id/juries*` (no `my-assignments*`, son actor-scope) |
| `fairJuryCategoryAssignment.routes.js` | `/:id/juries/:userId/categories*` |
| `fairCertificatesRouter` | `POST/:id/certificates/generate` |
| **con `requireProjectInScope`** | |
| `project.routes.js` | `GET/:id`, `GET/:id/members`, `PUT/:id`, `POST/:id/{submit,members,review}` (list/CREATE no aplican) |

**Trade-off documentado:** cada middleware añade 1-2 queries extra (load de fair/project) + `auditService.logAction` solo en fallo. Se recomienda aplicar en **todos** por coherencia (defensa en profundidad), no solo en los críticos.

---

## 3. Tarea 3 — Código Propuesto (sin aplicar)

### 3.1 Helper compartido `src/shared/guards/tenant.guard.js`

Diseño: **NO** bypass automático de SUPERADMIN (consistente con la regla de oro “tenants no se mezclan con plataforma” y con `scope.middleware.js:76-82`). Opciones explícitas cuando una ruta *sí* es de plataforma.

```js
// src/shared/guards/tenant.guard.js
// Guard de tenant compartido. Elimina la duplicación de
//   if (recurso.organizationId !== actor.organizationId) throw ...
// que hoy existe en ~9 services de FERIAS (fair.service:87, fairCategory:37,
// fairStand:36, juryAssignment:47, fairJuryCategoryAssignment:32,
// fairVoting.results:19, fairResult:17, certificate.helpers:32, fairEvaluation.access:25).
//
// Regla de oro: en rutas de TENANT el SUPERADMIN NO tiene bypass. El único
// responsable de permitir SUPERADMIN es la frontera de plataforma
// (PLATFORM_ACTIONS / router platform), no este helper.

import { ApiError } from '../errors/ApiError.js';
import { ROLES } from '../../constants/roles.js';

const isSuperUser = (actor) =>
  actor?.role === ROLES.SUPERADMIN || actor?.isSuperuser || actor?.isSuperAdmin;

/**
 * Valida que el recurso pertenezca a la organización del actor.
 * - Tenant route default: SUPERADMIN (sin organizationId) -> 403.
 * - Lanza 403 si el actor no tiene org o si org != resource.organizationId.
 * @param {Object} actor      req.user (organizationId, role)
 * @param {Object} resource   fila Prisma con organizationId
 * @param {string} resourceName  nombre para mensaje (p. ej. 'Feria')
 */
export function assertTenantMatch(actor, resource, resourceName = 'Recurso') {
  if (isSuperUser(actor)) {
    throw ApiError.forbidden(
      'El administrador de plataforma no tiene acceso a recursos de tenant'
    );
  }
  if (!actor?.organizationId) {
    throw ApiError.forbidden('Tu cuenta no está vinculada a ninguna organización');
  }
  if (!resource || resource.organizationId !== actor.organizationId) {
    throw ApiError.forbidden(
      `El ${resourceName.toLowerCase()} no pertenece a tu organización`
    );
  }
}

/**
 * Variante "404 seguro": no revela existencia cross-tenant.
 * Útil cuando el recurso se consulta por ID y no importa distinguir
 * "no existe" vs "existe pero no es tuyo".
 */
export function assertTenantMatchOrNotFound(actor, resource, resourceName = 'Recurso') {
  if (isSuperUser(actor)) {
    throw ApiError.forbidden(
      'El administrador de plataforma no tiene acceso a recursos de tenant'
    );
  }
  if (!actor?.organizationId) {
    throw ApiError.forbidden('Tu cuenta no está vinculada a ninguna organización');
  }
  if (!resource || resource.organizationId !== actor.organizationId) {
    throw ApiError.notFound(`${resourceName} no encontrada`);
  }
}

/**
 * Middleware para catálogos académicos sin columna organization_id.
 * 1) Garantiza actor autenticado con organizationId (403 en otro caso).
 * 2) Persiste req.organizationId para que services/repos lo consuman.
 * (Los filtros reales por JOIN se implementan en la FASE 15.3.)
 */
export const requireAcademicTenantScope = (req, res, next) => {
  const actor = req.user;
  if (!actor) return next(ApiError.unauthorized('No autenticado'));
  if (isSuperUser(actor)) {
    return next(
      ApiError.forbidden('El administrador de plataforma no tiene acceso a recursos de tenant')
    );
  }
  if (!actor.organizationId) {
    return next(ApiError.forbidden('Tu cuenta no está vinculada a ninguna organización'));
  }
  req.organizationId = actor.organizationId;
  if (!req.academicScope) req.academicScope = {};
  req.academicScope.organizationId = actor.organizationId;
  return next();
};

export default { assertTenantMatch, assertTenantMatchOrNotFound, requireAcademicTenantScope };
```

> **Diferencia frente a tu borrador:** el borrador hacía `if (actor.role === 'SUPERADMIN') return true;`. Eso **contradice** la regla del proyecto (la frontera rechaza SUPERADMIN en tenant; `scope.middleware.js:76-82` y `tenantScope.middleware.js:63-69` lo rechazan explícitamente). He optado por rechazo explícito + separación plataforma/tenant. Si prefieres el bypass, indícalo (**Q2**).

### 3.2 Ejemplo — `fairEngagement.routes.js` corregido (solo snippet de montaje)

```js
// src/modules/fairEngagement/fairEngagement.routes.js (PROPUESTA — no aplicada)
import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import {
  requireFairInScope,
  requireProjectInScope,
} from '../../middlewares/scope.middleware.js';
import { ROLES } from '../../constants/roles.js';
import * as fairEngagementController from './fairEngagement.controller.js';
import * as fairEngagementStudentController from './fairEngagement.student.controller.js';
import { likeSchema, unlikeSchema, likeStatusSchema,
  createCommentSchema, listCommentsSchema, updateCommentSchema, deleteCommentSchema } from './fairEngagement.schema.js';

const router = Router();
const JURY_ONLY = [ROLES.JURY];

// Likes
router.post('/:fairId/projects/:projectId/like',
  authenticate, authorize(JURY_ONLY), requireProjectInScope,
  validate(likeSchema), fairEngagementController.likeProject);

router.delete('/:fairId/projects/:projectId/like',
  authenticate, authorize(JURY_ONLY), requireProjectInScope,
  validate(unlikeSchema), fairEngagementController.unlikeProject);

router.get('/:fairId/projects/:projectId/likes/count',
  authenticate, requireProjectInScope,
  validate(likeStatusSchema), fairEngagementController.getLikeStatus);

router.get('/:fairId/projects/:projectId/engagement',
  authenticate, requireProjectInScope,
  validate(likeStatusSchema), fairEngagementStudentController.getEngagement);

// Comments
router.post('/:fairId/projects/:projectId/comments',
  authenticate, authorize(JURY_ONLY), requireProjectInScope,
  validate(createCommentSchema), fairEngagementController.createComment);

router.get('/:fairId/projects/:projectId/comments',
  authenticate, requireProjectInScope,
  validate(listCommentsSchema), fairEngagementController.listComments);

// Sin :projectId en la ruta -> guard vía fair
router.patch('/:fairId/comments/:commentId',
  authenticate, requireFairInScope,
  validate(updateCommentSchema), fairEngagementController.updateComment);

router.delete('/:fairId/comments/:commentId',
  authenticate, requireFairInScope,
  validate(deleteCommentSchema), fairEngagementController.deleteComment);

export default router;
```

> Cambios clave: import + inserción de `requireProjectInScope`/`requireFairInScope` en las 8 rutas. Los guards en service se suman en la FASE 15.3.

### 3.3 Ejemplo — `PlatformTranslation.routes.js` corregido (C6)

```js
// PROPUESTA — reemplazar authorize(ADMIN_ONLY) por authorizePlatform(SUPERADMIN)
import { authenticate, authorizePlatform } from '../../middlewares/auth.middleware.js';
const SUPERADMIN_ONLY = [ROLES.SUPERADMIN];

router.get('/effective-locale/:userId', authenticate, authorizePlatform(SUPERADMIN_ONLY), ...);
router.get('/',       authenticate, authorizePlatform(SUPERADMIN_ONLY), ...);
router.get('/:id',    authenticate, authorizePlatform(SUPERADMIN_ONLY), ...);
router.post('/',      authenticate, authorizePlatform(SUPERADMIN_ONLY), ...);
router.patch('/:id',  authenticate, authorizePlatform(SUPERADMIN_ONLY), ...);
router.delete('/:id', authenticate, authorizePlatform(SUPERADMIN_ONLY), ...);
// router.get('/dictionary') se mantiene PÚBLICO.
```

---

## 4. Tarea 4 — Rutas Huérfanas Remanentes (tras aplicar el mapa)

Después del mapa C1–C7, el único hueco irrecuperable a nivel middleware son las **rutas sobre tablas sin `organization_id` ni JOIN disponible**:

| Ruta | Tabla | Residual | Mitigación |
|---|---|---|---|
| `GET/POST/PUT/DELETE /api/academic/periods` (+ `/active`) | `academic_periods` (global) | 🔴 **huérfana real → mitigación migración aprobada (Q4)** | **Migración de BD**: `organization_id` en `academic_periods` (FK UK → organizations, CASCADE), índice, y activo por (org, código). Mientras tanto: `requireAcademicTenantScope` + nota de riesgo residual. |
| `GET/POST/PUT/DELETE /api/academic/faculties` y `/programs` | `faculties`, `programs` (globales) | 🔴 **huérfanas hasta migración (Q1 v2)** | **Migración de BD**: `organization_id` en `faculties` y `programs` (FK/UK → organizations, CASCADE), junto con la de `academic_periods`. Mitigación transitoria: `requireAcademicTenantScope` + garantizar en repository que el CREATE no inserte rows org-ajenas. |
| `GET /api/fairs/:fairId/voting/verify/:receiptCode` | `fair_votes` | ⚠️ pública por diseño (verificación de comprobante; respuesta booleana sin datos personales) | Aceptar con nota en docs. |
| `GET /api/fairs/my-assignments[/:fairId]` · `my-evaluations` · `my-progress/:fairId` · `voting/status` | `fair_jury_assignments`, `fair_evaluations`, `fair_vote_participation` | ⚠️ actor-scope (solo filas propias: `userId = actor.id`) | Verificar en 15.3 que el `select` no filtre fuera del actor y que `my-progress/:fairId` valide membresía (ya lo hace) |
| `GET /api/organizations/:id` | `organizations` | ⚠️ público por diseño (catálogo opcionalAuth) | Aceptar (doc FLUJO_ADMINISTRATIVO) |
| `GET /api/platform/translations/dictionary` | `platform_translations` | ⚠️ público por diseño (i18n de UI) | Aceptar |

**Conclusión:** los huérfanos genuinamente críticos son las 3 tablas académicas globales — `academic_periods`, `faculties`, `programs` — todas con **migración de BD aprobada** (Q1 v2 + Q4). `voter_registries` se resuelve SIN migración vía JOIN a users por su columna `user_id`.

### Dependencias / decisiones aprobadas

| ID | Decisión | Resolución |
|---|---|---|
| Q1 | `faculties`/`programs` | ✅ **TENANT-SCOPED (v2)** — migración `organization_id` + `requireAcademicTenantScope` transitorio |
| Q2 | SUPERADMIN en `assertTenantMatch` | ✅ **Sin bypass** — versión recomendada (rechazo explícito) |
| Q3 | `GET /api/audit/verify` | ✅ **Mover a router PLATFORM** (`/api/platform/audit/verify`, `authorizePlatform(SUPERADMIN)`) |
| Q4 | `academic_periods` | ✅ **Migración de BD**: agregar `organization_id` (FK → organizations, CASCADE) + índice + por-tenant activo; se agenda tras FASE 15.5 |

**Nota Q2:** `src/shared/guards/tenant.guard.js` mantiene el diseño sin bypass mostrado en §3.1 (difiere del borrador original del usuario, que hacía `if SUPERADMIN return true`).