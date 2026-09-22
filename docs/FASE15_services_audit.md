# FASE 15.3 — Auditoría de Services y Consultas Prisma (Multi-Tenant)

> **Fecha:** 2026-09-22 · **Depende de:** FASE 15.1 (matriz) + FASE 15.2 (middlewares, aprobada).
> **Decisiones aplicadas:** Sin bypass SUPERADMIN · Engagement aislado · Catálogos tenant-scoped vía `req.academicScope.organizationId` / JOIN users · Notifications validar destino · Onboarding `actor.organizationId === req.params.id`.
> **Estado:** SOLO AUDITORÍA + CÓDIGO PROPUESTO (no aplicado). Código de migración de BD queda fuera (aprobación pendiente en fase de BD).

---

## 0. Resumen ejecutivo (prioridad ❌)

| # | Archivo:línea | Hallazgo | Clasificación |
|---|---|---|---|
| E1 | `fairResult.repository.js` + `certificate.eligibility.service.js:42` | Llamada a función **inexistente** `countVotesByProject` | 🔴 **CRASH en runtime** |
| E2 | `certificate.eligibility.service.js:46` | Import dinámico de `fairResult.service.js` esperando `buildVoteRanking` que **no exporta** | 🔴 **CRASH en runtime** |
| E3 | `database/sql/academic/008_sis_sync.sql:25-103` (y copia en `challenges/001_candidacy_challenges.sql`) | `sync_sis_voters` **SECURITY DEFINER, cero org-check**: matchea `institutional_id` globalmente, actualiza `users.current_cycle` y hace upsert en `voter_registries` de TODOS los tenants | 🔴 **CRÍTICO (C2 SQL raw)** |
| E4 | `voter-registry.repository.js:58-100` (`findManyPaginated`) | `where` sin `user.organizationId` → padrón completo de todos los tenants para cualquier ADMIN | 🔴 **CRÍTICO (C2)** |
| E5 | `notification.service.js:76-98` + `notification.controller.js:56-66` | `createNotification` no recibe actor y no valida org del destinatario | 🔴 **CRÍTICO (C4)** |
| E6 | `organization.service.js:210,235` + `organization.routes.js:208-222` | `updateOnboarding`/`completeOnboarding` sin validar `actor.organizationId === params.id` (rutas en router PLATFORM sin guard) | 🔴 **CRÍTICO (C5)** |
| E7 | `fairEngagement.*.service.js` (likes/comments/student) | Ninguna consulta valida `organizationId`; lectura cross-tenant de autores/comentarios/engagement y borrado por ADMIN foráneo | 🔴 **CRÍTICO (C1)** |
| E8 | `period.service.js`/`faculty.service.js`/`program.service.js` (+ repos) | CRUD global sin org; `setActive` (`period.repository.js:70-83`) desactiva períodos de TODOS los tenants | 🔴 **CRÍTICO (C2, migración)** |
| ⚠️ | `fairVoting.service.js:87-168` | `castVote`/`getVotingStatus` sin assert org explícito (mitigado por invariancia de asignación JURY) | 🟡 defensa en profundidad |
| ⚠️ | `fairVoting.results.service.js:18-25` y `fairResult.service.js:17,113` | Guards de tenant **duplicados a mano** (≈9 en total) → unificar en helper compartido | 🟡 refactor |

---

## 1. Tarea 1 — Services FERIAS (línea por línea)

### 1.1 `fairEngagement.likes.service.js`

| Línea | Consulta / lógica | Org-check | Código actual (resumen) | Clasif. |
|---|---|---|---|---|
| 16-19 | `assertJuryAssignedToFair` | n/a | `juryAssignment.findByFairUser` | ✅ invariancia |
| 21-30 | `assertProjectInFairApproved` | ❌ **no** | `projectRepository.findById(projectId)` → chequea solo `project.fairId === fairId` | ❌ |
| 45/48/62 | `findLike`/`countLikesByProject` | ❌ indirecta | indexed por `projectId` | ❌ |
| 98-108 | `getLikeStatus` | ❌ **no** | count de likes de cualquier proyecto (usa `assertProjectInFairApproved`, sin org) | ❌ |
| repo 17-18 | `countLikesByProject` | ❌ | `fairProjectLike.count({ where: { projectId } })` | ❌ |

**Riesgo:** ADMIN/JURY de Org B, sabiendo un `projectId` de Org A, lee `count`/`hasLiked` y (tras montar las rutas) escribe/borra likes cross-tenant. El middleware `requireProjectInScope` (15.2, Grupo 1) cierra la puerta; este guard lo hace a nivel service.

**Código corregido (propusio):**
```js
// src/modules/fairEngagement/fairEngagement.likes.service.js
import { assertTenantMatch } from '../../shared/guards/tenant.guard.js';

const assertProjectInFairApproved = async (fairId, projectId, actor) => {
  const project = await projectRepository.findById(projectId);
  if (!project || project.fairId !== fairId) {
    throw ApiError.notFound('Proyecto no encontrado en esta feria');
  }
  assertTenantMatch(actor, project, 'Proyecto');   // ← NUEVO: org == actor
  if (project.status !== 'APPROVED') {
    throw ApiError.conflict('Solo se puede interactuar con proyectos aprobados');
  }
  return project;
};

// likeProject / unlikeProject / getLikeStatus: pasar `actor` al helper
await assertProjectInFairApproved(fairId, projectId, actor);
```

### 1.2 `fairEngagement.comments.service.js`

| Línea | Lógica | Org-check | Riesgo | Clasif. |
|---|---|---|---|---|
| 82-108 | `listComments` | ❌ | Leer comentarios **con autor** de proyectos de otra org (ADMIN) | ❌ |
| 111-133 | `updateComment` | ❌ | Solo exige ser el autor | ❌ |
| 136-149 | `deleteComment` | ❌ | **ADMIN de Org B borra comentarios de Org A** (solo exige isAdmin) | ❌ |

**Código corregido:**
```js
// listComments: tras `assertProjectInFairApproved`
const project = await assertProjectInFairApproved(fairId, projectId, actor);
assertTenantMatch(actor, project, 'Proyecto');

// updateComment / deleteComment: cargar el proyecto del comentario y validar org
const comment = await engagementRepository.findComment(commentId);
if (!comment) throw ApiError.notFound('Comentario no encontrado');
await assertCommentInFair(comment, fairId);
const project = await projectRepository.findById(comment.projectId);
assertTenantMatch(actor, project, 'Proyecto');   // ← cierra admin cross-tenant
// ... luego reglas de autor / moderación
```

### 1.3 `fairEngagement.student.service.js`

| Línea | Lógica | Org-check | Clasif. |
|---|---|---|---|
| 13-21 | `assertProjectInFair` | ❌ (fair + project cargados, sin org) | ❌ |
| 28-54 | `assertCanViewEngagement` | ❌ — línea 31: `if (actor.role === ADMIN) return` **sin org check** | ❌ |
| 61-75 | `getProjectEngagement` | ❌ | ❌ |

**Código corregido:**
```js
const assertProjectInFair = async (fairId, projectId, actor) => {
  const fair = await fairRepository.findById(fairId);
  if (!fair) throw ApiError.notFound('Feria no encontrada');
  assertTenantMatch(actor, fair, 'Feria');          // ← NUEVO
  const project = await projectRepository.findById(projectId);
  if (!project || project.fairId !== fairId) {
    throw ApiError.notFound('Proyecto no encontrado en esta feria');
  }
  return { fair, project };
};
```

### 1.4 `fairVoting.service.js` (castVote / getVotingStatus)

Mitigado por la invariancia `fair_jury_assignments` (el jurado solo puede estar asignado a ferias de su propia org). Falta el assert org explícito → 🟡 defensa en profundidad.

```js
const loadFair = async (fairId) => {
  const fair = await fairRepository.findById(fairId);
  if (!fair) throw ApiError.notFound('Feria no encontrada');
  return fair;
};

export const castVote = async ({ fairId, data, actor }) => {
  assertJuryRole(actor);
  const fair = await loadFair(fairId);
  assertTenantMatch(actor, fair, 'Feria');           // ← NUEVO
  assertVotingPeriod(fair);
  await assertJuryAssignedToFair({ fairId, juryId: actor.id });
  ...
};
// getVotingStatus: mismo cambio tras loadFair.
```

### 1.5 `fairVoting.results.service.js`

| Línea | Lógica | Clasif. |
|---|---|---|
| 76-97 | `getVotingResults` | ✅ **ya protegido** (`assertTenantMatch` local :18-25) |
| 18-25 | guard duplicado a mano | 🟡 → refactor a `assertTenantMatch` compartido |
| 104-122 | `verifyReceipt` | ⚠️ público por diseño (aceptado) |

```js
// Refactor propuesto del guard local (líneas 18-25) — eliminarlo y usar el helper:
import { assertTenantMatch } from '../../shared/guards/tenant.guard.js';
// dentro de getVotingResults:
const fair = await loadFair(fairId);
assertTenantMatch(actor, fair, 'Feria');
```

### 1.6 `fairResults/fairResult.service.js`

| Línea | Lógica | Clasif. |
|---|---|---|
| 7-98 | `getResults` | ✅ org-check presente (:17-22) — pero usa `Error` genérico y es duplicado manual |
| 103-149 | `publishResults` | ✅ org-check presente (:113-118) — duplicado manual |
| 154-190 | `getProjectReviewForJury` | 🟡 seguro por invariancia; añadir `assertTenantMatch(fair)` por consistencia |

⚠️ **Detalle:** los `throw new Error(...)` con `statusCode` propio NO usan `ApiError`. Propuesta de unificación (consistente + helper compartido):
```js
static async getResults(fairId, currentUser) {
  const fair = await fairResultRepository.findFairById(fairId);
  if (!fair) throw ApiError.notFound('Feria no encontrada');
  assertTenantMatch(currentUser, fair, 'Feria');   // ← helper compartido
  ...
}
```

### 1.7 `fairResults/fairResult.repository.js`

Todas las queries viven escaladas por `fairId` (listApprovedProjects :22-39, findPublicationByFair :62-66, findJuryAssignment :90-93, findProjectForJuryReview :99-128) y son seguras **solo si** el service verifica el org de la feria ANTES. Clasificación: 🟡 (defensa en profundidad se resuelve en service; no se requiere org dentro de cada where mientras el org-check preceda).

### 1.8 `certificate*.js`

| Archivo:línea | Hallazgo | Clasif. |
|---|---|---|
| `certificate.eligibility.service.js:42` | `fairResultRepository.countVotesByProject(fairId)` → **función inexistente en fairResult.repository (E1)** | 🔴 crash |
| `certificate.eligibility.service.js:46` | `await import('../fairResults/fairResult.service.js')` → `buildVoteRanking` **no existe** en ese módulo (solo exporta la clase) (E2) | 🔴 crash |
| `certificate.helpers.js:25-36` | `assertAdminTenantForFairPure` ✅ correcto (sin bypass) | ✅ |
| `certificate.helpers.js:43-47` | `canAdminReadOthersCertificate` ✅ correcto (usa `cert.fair.organizationId`) | ✅ |
| `certificate.repository.js:19-29` | `CERTIFICATE_SELECT` incluye `fair.organizationId` ✅ (imprescindible para el check anterior) | ✅ |
| `certificate.service.js:42-118` | `generateCertificates` ✅ (`assertAdminTenantForFair` ya presente) | ✅ |
| `certificate.service.js:136-147` | `getCertificateById` ✅ (owner o `canAdminReadOthersCertificate`) | ✅ |

**Código corregido para E1+E2** (hace funcionar `determineWinnerProjectId`):
```js
// src/modules/certificate/certificate.eligibility.service.js
import * as votingRepository from '../fairVoting/fairVoting.repository.js';
import { buildVoteRanking } from '../fairVoting/fairVoting.helpers.js';   // ← módulo correcto
// (eliminar el import dinámico de fairResult.service.js)

export const determineWinnerProjectId = async ({ fairId, fair }) => {
  const publication = await fairResultRepository.findPublicationByFair(fairId);
  if (!publication) return null;
  if (fair.status !== 'CLOSED') return null;

  const [projects, votesByProject] = await Promise.all([
    fairResultRepository.listApprovedProjects(fairId),
    votingRepository.countVotesByFair(fairId),          // ← devuelve Map {projectId: count}
  ]);

  const ranking = buildVoteRanking(projects, votesByProject);
  const winner = ranking.find((entry) => entry.winner === true);
  return winner ? winner.project_id : null;
};
```

> ⚠️ **Pregunta pendiente (semántica):** `getFairResults()` ordena por **promedio de evaluaciones** (`total_score`), pero `determineWinnerProjectId` asigna el ganador por **votos** (`buildVoteRanking`). El comentario de `certificate.service.js:9-10` dice que la fuente de verdad es `getFairResults()`. ¿El certificado WINNER debe salir de los **votos** o de la **evaluación**? (ver P1 en §5)

---

## 2. Tarea 2 — Notificaciones y Onboarding

### 2.1 `notification.service.js:76-98` + `notification.controller.js:56-66` (C4)

Estado: `createNotification(req.body)` sin `actor`. Fuga cross-tenant: un ADMIN (de A) crea notificación con `user_id` de la org B.

**Código corregido:**
```js
// notification.repository.js — añadir:
export const findUserOrganizationId = (userId) =>
  prisma.user.findUnique({
    where: { id: userId },
    select: { organizationId: true },
  });

// notification.service.js — firma con actor + guard:
export const createNotification = async (body, actor) => {
  const targetUser = await notificationRepository.findUserOrganizationId(body.user_id);
  if (!targetUser) {
    throw ApiError.badRequest('El usuario destinatario no existe');
  }
  if (actor?.organizationId && targetUser.organizationId !== actor.organizationId) {
    throw ApiError.forbidden('El destinatario no pertenece a tu organización');
  }

  const notificationData = { userId: body.user_id, ... };
  try {
    const result = await notificationRepository.createNotificationWithDeliveries(notificationData, body.channels);
    return { notification: formatNotification(result.notification), deliveries_scheduled: result.deliveries.length };
  } catch (err) {
    throw translatePrismaError(err);
  }
};

// notification.controller.js:56-66:
const result = await notificationService.createNotification(req.body, req.user);
```

### 2.2 `organization.service.js:210,235` + controller + routes (C5)

Estado: rutas en sub-router PLATFORM (`organization.routes.js:208-222`) con `authorize('ADMIN')` pero **sin validación** de que `:id` sea el org del actor.

**Código corregido:**
```js
// organization.service.js
import { assertTenantMatch } from '../../../shared/guards/tenant.guard.js';

export const updateOnboarding = async (organizationId, data = {}, actor) => {
  assertTenantMatch(actor, { organizationId }, 'Organización');   // ← NUEVO
  const existingOrg = await orgRepository.findOrgById(organizationId);
  ...
};

export const completeOnboarding = async (organizationId, actor) => {
  assertTenantMatch(actor, { organizationId }, 'Organización');   // ← NUEVO
  const existingOrg = await orgRepository.findOrgById(organizationId);
  ...
};

// organization.controller.js:74-90 — pasar req.user:
const organization = await organizationService.updateOnboarding(req.params.id, req.body, req.user);
const organization = await organizationService.completeOnboarding(req.params.id, req.user);
```

---

## 3. Tarea 3 — Services Académicos (mitigación pre-migración)

> **COMENTARIO GENERAL:** `period`, `faculty` y `program` **no tienen** columna `organization_id` en la BD actualmente. El código corregido asume la migración aprobada (Q1 v2/Q4, fase de BD). `voter_registries` SÍ es aislable hoy vía JOIN a `users.organization_id`.

### 3.1 `voter-registry` (✓ aislable hoy, sin migración)

**Riesgo E4:** `voter-registry.repository.js:58-100` — `where = {}` sin org; expone y puede mutar el padrón de TODOS los tenants.

**Código corregido (repository + service reciben actor):**
```js
// voter-registry.repository.js — filtrar por organización del actor (JOIN a users)
async findManyPaginated({ skip, take, periodId, programId, isEligible, search, organizationId }) {
  const where = {
    user: { organizationId },              // ← NUEVO: filtra el padrón por org
  };

  if (periodId) where.periodId = periodId;
  if (programId) where.programId = programId;
  if (typeof isEligible === 'boolean') where.isEligible = isEligible;

  if (search) {
    where.user = {
      organizationId,                      // ← combinar con el filtro de búsqueda
      OR: [
        { institutionalId: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
      ],
    };
  }
  ...
}

// voter-registry.service.js — recibir organizationId del actor (req.academicScope)
async getVoters(queryParams, organizationId) {
  ... await voterRegistryRepository.findManyPaginated({ ..., organizationId });
}
// createVoter / getVoterById / updateVoter / deleteVoter:
async createVoter(voterData, organizationId) {
  const existing = await voterRegistryRepository.findByUserAndPeriod(voterData.userId, voterData.periodId);
  if (existing) throw { 409 };
  return voterRegistryRepository.create({ ...voterData, user: { connect: { organizationId } } });
}
// getVoterById(id, organizationId): verificar que voter.user.organizationId === organizationId → si no, 404/403.
```

### 3.2 `period.*` (require migración — COMENTARIO: requiere migración 013 aplicada)

**Riesgo E8:** `period.service.js:5-107` CRUD global; `period.repository.js:70-83 setActive` desactiva el activo de TODOS los tenants (`updateMany({ where: { isActive: true } })`).

**Código corregido (post-migración):**
```js
// period.service.js — recibir organizationId (req.academicScope) y escalar todo por org
export const listPeriods = async (query = {}, organizationId) => {
  ...
  periodRepository.list({ organizationId, skip, take });
  periodRepository.count(organizationId);
};
export const getPeriodById = async (id, organizationId) => {
  const period = await periodRepository.findById(id, organizationId);
  if (!period) throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Período no encontrado');
  return period;
};
export const createPeriod = async (payload, organizationId) => {
  const isActive = payload.is_active ?? false;
  if (isActive) {
    const overlapping = await periodRepository.checkOverlap(start, end, null, organizationId);
    if (overlapping) throw new ApiError(HTTP_STATUS.CONFLICT, ...);
  }
  return periodRepository.create({ ..., organizationId });
};
// setActivePeriod(id, organizationId):
export const setActivePeriod = async (id, organizationId) => {
  await getPeriodById(id, organizationId);
  return periodRepository.setActive(id, organizationId);
};

// period.repository.js — toda consulta con organizationId
PERIOD_SELECT = { ..., organizationId: true };
findById = (id, organizationId) => prisma.academicPeriod.findUnique({ where: { id, organizationId }, select });
checkOverlap = (startDate, endDate, excludeId, organizationId) => prisma.academicPeriod.findFirst({
  where: { isActive: true, organizationId, AND: [...] },
});
setActive = async (id, organizationId) => prisma.$transaction(async (tx) => {
  await tx.academicPeriod.updateMany({ where: { isActive: true, organizationId }, data: { isActive: false } }); // ← SOLO su org
  return tx.academicPeriod.update({ where: { id }, data: { isActive: true }, select: PERIOD_SELECT });
});
```

### 3.3 `faculty.*` y `program.*` (require migración — COMENTARIO: requiere migración 013 aplicada)

Mismo patrón; las únicas queries org-ajenas hoy: `faculty.repository.list/count/findByNameOrCode` (`faculty.service.js:10-44`) y `program.repository.list/count/create/findById/update/deleteById`. Todas deben escalar por `organizationId` tras la migración. Ejemplo (facultad):

```js
// faculty.service.js
export const listFaculties = async (query = {}, organizationId) => {
  ... facultyRepository.list({ organizationId, skip, take }); facultyRepository.count(organizationId);
};
export const createFaculty = async (data, organizationId) => {
  const existing = await facultyRepository.findByNameOrCode(data.name, data.code, organizationId);
  ...
  return facultyRepository.create({ ...data, organizationId });
};
export const updateFaculty = async (id, data, organizationId) => {
  await getFacultyById(id, organizationId);
  ... facultyRepository.update(id, data, organizationId);
};
```
> El UNIQUE `(name|code)` y `programs.(code, facultyId)` deberán pasar a ser `(organizationId, name)`/`(organizationId, code)` en la migración (nueva UK → nota para fase BD).

---

## 4. Tarea 4 — SQL Directo (`$queryRaw` / `$executeRaw`): 14 usos

| Archivo:línea | Query | Org-scope en SQL | Clasif. |
|---|---|---|---|
| `PlatformTranslation.service.js:23-26` | `get_ui_translations(locale, category)` | ✅ diccionario global público (i18n) | ✅ |
| `PlatformTranslation.service.js:39-42` | `get_effective_locale(userId)` | ⚠️ lee locale de `user_id` arbitrario → ruta movida a SUPERADMIN (C6) | 🟡 (aceptado con C6) |
| `voter-registry.repository.js:8-17` | `sync_sis_voters(op, period, students)` | 🔴 **SIN org** (E3) | 🔴 |
| `health.controller.js:24` | `SELECT 1` | ✅ | ✅ |
| `otp.repository.js:92-97` | `SELECT two_factor_backup_codes ... WHERE id = ${userId}` | ✅ scoped by `userId` (self-service) | ✅ |
| `auth.repository.js:118-170` | `login_is_allowed`, `register_failed/successful_login`, `generate_password_reset_token`, `reset_password_with_token`, `verify_email_with_token` | ✅ funciones self-service por token/email | ✅ |
| `organization.repository.js:135-147,177-189` | `approve_organization_request`, `approve_request_for_admin_activation` | ⚠️ funciones de plataforma (crear org + invitar ADMIN) — gateado por SUPERADMIN en rutas (verificar `approval.routes`) | 🟡 |

### 📌 BLOQUEADO — `sync_sis_voters` (E3, hallazgo crítico)

**Evidencia** (`database/sql/academic/008_sis_sync.sql`):
- `:24-31` solo valida `role = 'ADMIN'` **sin vínculo con la org del operador**.
- `:62-71` matchea usuarios por `institutional_id` de **cualquier tenant**; `:72-80` actualiza `users.current_cycle` de esas filas; `:81-103` hace upsert en `voter_registries` por `(user_id, period_id)` globalmente.
- El período también es global (`:34-39`).
- `SECURITY DEFINER` (:12) → alto privilegio.
- **Duplicación:** existe una 2ª copia idéntica en `database/sql/challenges/001_candidacy_challenges.sql:5-113` que, ejecutada, **sobrescribe** la primera (CREATE OR REPLACE) y le quita la validación del período activo (¡esa versión NO valida el período!).

**Mitigación JS inmediata (no requiere tocar SQL) — propuesta:**
```js
// voter-registry.service.js
async syncSisVoters(actor, payload) {
  const { periodId, students } = payload;
  // Pre-validación JS (mientras no exista organization_id en academic_periods):
  //  - actor es ADMIN (ya lo exige authorize en la ruta).
  //  - El período debe pertenecer a la org del actor → NO verificable hoy (sin columna).
  //    Mitigación transitoria: solo el SUPERADMIN/plataforma ejecuta sync-sis hasta la migración,
  //    o se fuerza periodId a un período marcado como perteneciente al operador a nivel de servicio.
  const operatorUserId = actor.id ?? actor.userId;
  const result = await voterRegistryRepository.callSyncSisVotersProcedure(operatorUserId, periodId, students);
  return result;
}
```
> ⚠️ **La mitigación JS es insuficiente** mientras `academic_periods` no tenga org y el SQL no filtre por `users.organization_id`. El fix real (SQL) queda **agendado a la fase de BD**: añadir `p_org` y filtrar `matched_users JOIN users u ON ... AND u.organization_id = p_org`, y validar `period.organization_id = p_org`. (ver P2 en §5)

---

## 5. Decisiones resueltas (P1 + P2)

| ID | Decisión | Implicación |
|---|---|---|
| **P1** | ✅ **VOTOS = Ganador.** El voto único/anónimo (`fairVotes` → `buildVoteRanking`) es la métrica cuantitativa que define al ganador; la rúbrica es feedback cualitativo. | `determineWinnerProjectId` corrige su implementación (E1/E2) usando `fairVoting.helpers.buildVoteRanking` + `fairVoting.repository.countVotesByFair`. **Observación a verificar en 15.5:** `fairResult.getResults()` hoy marca `winner` por **promedio de evaluación** (`total_score`) cuando `isPublished` — propondré alinear esa bandera también por votos para consistencia con los certificados. |
| **P2** | ✅ **Fix SQL agendado + mitigación transitoria.** Restringir `/sync-sis` y dejar `014_fix_sis_sync.sql` para la fase de BD. | ⚠️ **Matiz crítico de implementación:** la ruta `POST /api/academic/voter-registries/sync-sis` cuelga del `tenantRouter`, donde `blockSuperAdminFromTenantRoutes` **rechaza a SUPERADMIN antes de cualquier `authorize`**. Cambiar `authorize(ADMIN)` → `authorize(SUPERADMIN)` **en el tenantRouter produciría una ruta muerta**. La mitigación real (siguiendo el precedente Q3 de `/audit/verify`): **reubicar la ruta a un sub-router PLATFORM**. |

### §5.1 Codigo propuesto — Mitigación transitoria `/sync-sis` (DÍA 1, sigue el patrón Q3)

```js
// src/routes/index.js — mover al router PLATFORM (fuera de tenantRouter):
// (junto a la relocación de /audit/verify, ya aprobada en FASE 15.2)
import platformAcademicVoterRegistriesRoutes from '../modules/academic/voter-registry/voter-registry.platform.routes.js';

// platformRouter.use('/academic/voter-registries', platformAcademicVoterRegistriesRoutes);

// src/modules/academic/voter-registry/voter-registry.platform.routes.js (NUEVO)
import { Router } from 'express';
import { authenticate, authorizePlatform } from '../../../middlewares/auth.middleware.js';
import { validate } from '../../../middlewares/validate.middleware.js';
import { ROLES } from '../../../constants/roles.js';
import voterRegistryController from './voter-registry.controller.js';
import { syncSisVotersSchema } from './voter-registry.schema.js';

const router = Router();

// SOLO SUPERADMIN ejecuta la sincronización masiva hasta el fix SQL (P2).
router.post(
  '/sync-sis',
  authenticate,
  authorizePlatform([ROLES.SUPERADMIN]),
  validate(syncSisVotersSchema),
  voterRegistryController.syncSisVoters
);

export default router;
```

### §5.2 Fix SQL agendado — `database/sql/academic/014_fix_sis_sync.sql` (FASE BD, borrador propuesto)

```sql
-- PROBLEMA (E3): sync_sis_voters filtra por institutional_id GLOBAL, sin organización.
-- SÍNTOMA: un ADMIN de la org A puede sincronizar/pisear el padrón de la org B.
-- FIX: añadir p_org UUID y filtrar matching + período por organización.

CREATE OR REPLACE FUNCTION sync_sis_voters(
    p_operator_user_id UUID,
    p_org              UUID,          -- ← NUEVO: organización de operador/período
    p_period_id        UUID,
    p_students         JSONB
)
RETURNS TABLE (processed INT, updated INT, protected INT, unmatched INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_operator_role VARCHAR(20);
    v_operator_org  UUID;
    v_period_active BOOLEAN;
    v_period_org    UUID;
    v_total_input   INT := 0;
    ...
BEGIN
    SELECT role::VARCHAR, organization_id INTO v_operator_role, v_operator_org
    FROM public.users WHERE id = p_operator_user_id AND status = 'ACTIVE';

    IF v_operator_role IS NULL OR v_operator_role != 'ADMIN' THEN
        RAISE EXCEPTION 'Acceso denegado: Solo administradores pueden ejecutar la sincronización SIS.';
    END IF;

    SELECT is_active, organization_id INTO v_period_active, v_period_org
    FROM public.academic_periods WHERE id = p_period_id;

    IF v_period_active IS NOT TRUE OR v_period_org IS DISTINCT FROM v_operator_org THEN
        RAISE EXCEPTION 'Período inválido o de otra organización.';
    END IF;

    WITH matched_users AS (
        SELECT u.id AS user_id, d.program_id, d.cycle
        FROM input_data d
        JOIN public.users u
          ON u.institutional_id = d.institutional_id
         AND u.organization_id = v_operator_org          -- ← NUEVO filtro de tenant
        WHERE u.status = 'ACTIVE' AND u.role = 'STUDENT'
    ), ...
$$
;
-- Nota: adecuar la firma en voter-registry.repository.js (añadir p_org) y en la
-- copia de challenges/001_candidacy_challenges.sql (eliminar la duplicación en 15.4).
```

> ⚠️ **Recordatorio 15.4:** existe una **2ª copia** de `sync_sis_voters` en `database/sql/challenges/001_candidacy_challenges.sql:5-113` que, al aplicarse, **sobrescribe** la versión de `008_sis_sync.sql` (CREATE OR REPLACE) y además **pierde la validación del período activo**. Debe consolidarse en un único script en la fase de duplicación.

---

## 6. Tabla consolidada de consultas auditadas

| Archivo | Líneas | Clasif. |
|---|---|---|
| fairEngagement.likes.service.js | 39-108 | ❌ |
| fairEngagement.comments.service.js | 82-149 | ❌ |
| fairEngagement.student.service.js | 13-75 | ❌ |
| fairEngagement.repository.js | 6-64 | ❌ (escalado por service) |
| fairVoting.service.js | 87-168 | 🟡 |
| fairVoting.results.service.js | 18-25, 76-97 | ✅ + 🟡 (dup guard) |
| fairVoting.repository.js | 28-77 | 🟡 |
| fairResults/fairResult.service.js | 17, 113 | ✅ + 🟡 (dup guard) |
| fairResults/fairResult.repository.js | 8-128 | 🟡 |
| certificate.service.js | 42-147 | ✅ |
| certificate.eligibility.service.js | 42, 46 | 🔴 (crash) |
| certificate.helpers.js | 25-47 | ✅ |
| certificate.repository.js | 19-109 | ✅ (incluye org en select) |
| notification.service.js | 76-98 | 🔴 (C4) |
| notification.repository.js | 70-94 | 🟡 |
| organization.service.js | 210, 235 | 🔴 (C5) |
| period.service.js / repository.js | global | 🔴 (C2, migración) |
| faculty.* / program.* | global | 🔴 (C2/Q1v2, migración) |
| voter-registry.service.js / repository.js | global | 🔴 (C2; JOIN viable) |
| voter-registry.repository.js:8-17 | sync_sis_voters | 🔴 (E3) |
| PlatformTranslation.service.js | 21-48 | ✅ / 🟡 |
| auth/otp/health raw SQL | — | ✅ |
| organization.repository.js (raw) | 135-189 | 🟡 |

**Siguiente paso:** esperando "✅ Aprobado FASE 15.3" para avanzar a FASE 15.4 (Duplicación + Tests).