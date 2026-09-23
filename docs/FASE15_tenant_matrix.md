# FASE 15.1 — Mapeo Completo de Rutas y Tablas (Multi-Tenant)

> **Fecha:** 2026-09-22 · **Alcance:** 32 archivos de rutas, ~3000 líneas, 23 módulos.
> **Base URL:** Todos los montajes parten de `/api` (`src/app.js:132`).
> El árbol de tenant (`tenantRouter`) aplica `authenticate → blockSuperAdminFromTenantRoutes` ANTES de cualquier `authorize()` (`src/routes/index.js:90-132`), por lo que **SUPERADMIN es rechazado con 403 en TODAS las rutas de tenant**.

---

## 1. 🔴 CRÍTICOS DETECTADOS (notificación inmediata, FASE 15.1)

Los siguientes hallazgos violan la Regla de Oro del proyecto y requieren decisión YA:

| # | Archivo:línea | Ruta | Riesgo |
|---|---|---|---|
| C1 | `src/modules/fairEngagement/*.service.js` (módulo completo) | `GET/POST/PATCH/DELETE /api/fairs/:fairId/projects/:projectId/like`, `/comments`, `/engagement`, `/likes/count` | **CERO tenant-scope en todo el módulo.** Un ADMIN de Org B puede leer comentarios **con autor** de proyectos de Org A (`comments.service.js:103-104`), eliminar cualquier comentario (`:142-144`), y cualquier rol autenticado puede leer like-counts cross-tenant |
| C2 | `src/modules/academic/faculty/*`, `program/*`, `period/*`, `voter-registry/*` | `/api/academic/faculties`, `/programs`, `/periods`, `/voter-registries` | **Tablas globales con CRUD completo sin aislamiento.** `voter_registries` expone/corrompe el padrón electoral de TODOS los tenants. `setActivePeriod` además desactiva períodos activos de TODOS los tenants (`period.repo:72`) |
| C3 | `src/modules/audit/audit.repository.js:107-126` | `GET /api/audit/logs/:id` | ADMIN de cualquier tenant lee **cualquier** audit log por ID (sin JOIN a org). Además `GET /api/audit/verify` ejecuta reporte global de cadena |
| C4 | `src/modules/notification/notification.service.js:76` + `repo:71-93` | `POST /api/notifications` | ADMIN crea notificaciones para **cualquier** `user_id` de la BD sin validar misma organización |
| C5 | `src/modules/organizations/organization/organization.service.js:210,235` | `PATCH/POST /api/organizations/:id/onboarding`, `/onboarding/complete` | **Sin verificación `actor.organizationId === :id`.** Un ADMIN tenant puede finalizar/editar el onboarding de otra organización (ruta vive en router PLATFORM solo con `authorize('ADMIN')`) |
| C6 | `src/modules/PlatformTranslation/*` | `GET /platform/translations/effective-locale/:userId` y TODO el CRUD de traducciones | Traducciones globales editables por cualquier ADMIN tenant + fuga de locale de usuarios arbitrarios vía `:userId` |
| C7 | `src/modules/fairEngagement/*` | `requireFairInScope` / `requireProjectInScope` (`scope.middleware.js:62,96`) | Estos middlewares SI existen pero **NO se montan en ninguna ruta** (grep = 0 usos) |

**No bloquea el mapeo; se documenta en 15.2/15.3 con código propuesto.**

---

## 2. Tabla de Rutas → Middlewares → Service → Tablas

Convenciones:
- **MW:** A=auth, **R(rol)**=authorize, **X**=blockSuperAdminFromTenantRoutes (global del tenantRouter), **S**=scope/tenant middleware, **V**=validate.
- **org en query:** ✅=filtra por org en WHERE/JOIN del recurso principal · 🟡=valida org en service ANTES de consultar (por ID) · ❌=no hay aislamiento en el flujo.

### 2.1 Fairs

| Método | Ruta | MW | Controller→Service | Tablas | org |
|---|---|---|---|---|---|
| GET | `/api/fairs/` | A,R(ADMIN) | listFairs→`fair.service:142` | fairs | ✅ `organizationId` en WHERE |
| POST | `/api/fairs/` | A,R(ADMIN) | createFair→`fair.service:169` | fairs, organization_sites | ✅ create con org; site validado |
| GET | `/api/fairs/:id` | A,R(ADMIN) | getFairById→`fair.service:163` | fairs | 🟡 assertTenantMatch→403 (`:87`) |
| PUT | `/api/fairs/:id` | A,R(ADMIN) | updateFair→`fair.service:190` | fairs, organization_sites | 🟡 assertTenantMatch→403 |
| POST | `/api/fairs/:id/status` | A,R(ADMIN) | changeFairStatus→`fair.service:218` | fairs, fair_vote_participation, fair_evaluations, fair_categories, projects, fair_jury_category_assignments | 🟡 fair validada primero |

### 2.2 Projects

| Método | Ruta | MW | Controller→Service | Tablas | org |
|---|---|---|---|---|---|
| GET | `/api/projects/` | A | listProjects→`project.lifecycle:45` | projects | ✅ buildVisibilityWhere org |
| GET | `/api/projects/:id` | A | getProjectById→`project.lifecycle:65` | projects | 🟡 assertTenantMatch→403 |
| GET | `/api/projects/:id/members` | A | listMembers→`project.members:33` | projects, project_members | 🟡 |
| POST | `/api/projects/` | A,R(STUDENT,TEACHER) | createProject→`project.lifecycle:79` | fairs, fair_categories, projects | ✅ create con org; fair validada |
| PUT | `/api/projects/:id` | A,R(CREATORS) | updateProject→`project.lifecycle:119` | projects, fairs, fair_categories | 🟡 |
| POST | `/api/projects/:id/submit` | A,R(CREATORS) | submitProject→`project.lifecycle:177` | projects, fairs | 🟡 |
| POST | `/api/projects/:id/members` | A,R(CREATORS) | addMember→`project.members:49` | projects, fairs, users, project_members | 🟡 + usuario cotejado vs org (`:61`) |
| DELETE | `/api/projects/:id/members/:userId` | A,R(CREATORS) | removeMember→`project.members:80` | projects, fairs, project_members | 🟡 |
| POST | `/api/projects/:id/review` | A,R(ADMIN) | reviewProject→`project.lifecycle:206` | projects, fairs | 🟡 |

### 2.3 FairVoting

| Método | Ruta | MW | Controller→Service | Tablas | org |
|---|---|---|---|---|---|
| POST | `/api/fairs/:fairId/votes` | A,R(JURY) | castVote→`fairVoting.service:87` | fairs, fair_jury_assignments, users, fair_jury_category_assignments, projects, fair_vote_participation, fair_votes | 🟡 org validada en `juryCategoryAccess:63` (403) |
| GET | `/api/fairs/:fairId/voting/status` | A,R(JURY) | getVotingStatus→`fairVoting.service:157` | fairs, fair_jury_assignments, fair_vote_participation | ❌ solo membresía (sin compare org) |
| GET | `/api/fairs/:fairId/voting/results` | A,R(ADMIN) | getVotingResults→`fairVoting.results:76` | fairs, projects, fair_votes | 🟡 guard `results:19-24` (403) |
| GET | `/api/fairs/:fairId/voting/verify/:receiptCode` | **público** | verifyReceipt→`fairVoting.results:104` | fairs, fair_votes | n/a (público por diseño, solo booleano) |

### 2.4 FairEvaluations (rúbrica)

| Método | Ruta | MW | Controller→Service | Tablas | org |
|---|---|---|---|---|---|
| GET | `/api/fairs/my-evaluations` | A,R(JURY) | listMyEvaluations→`exposition:181` | fair_evaluations | ❌ scope por juryUserId (propio) |
| GET | `/api/fairs/my-progress/:fairId` | A,R(JURY) | getMyProgress→`exposition:238` | fairs, fair_jury_assignments, projects, fair_evaluations (+ fair_jury_declarations roto) | ❌ solo membresía |
| POST | `/api/fairs/:id/rubric` | A,R(ADMIN) | createRubric→`rubric:15` | fairs, fair_rubrics | 🟡 |
| GET | `/api/fairs/:id/rubric` | A,R(ADMIN,JURY) | getRubricForActor→`service:21` | fairs, fair_jury_assignments, fair_rubrics | 🟡 (ADMIN) / ❌ membresía (JURY) |
| PUT | `/api/fairs/:id/rubric` | A,R(ADMIN) | updateRubric→`rubric:35` | fairs, fair_rubrics | 🟡 |
| POST | `/api/fairs/:id/rubric/criteria` | A,R(ADMIN) | addCriterion→`rubric:52` | fairs, fair_rubrics, rubric_criteria | 🟡 |
| PUT | `/api/fairs/:id/rubric/criteria/:criterionId` | A,R(ADMIN) | updateCriterion→`rubric:83` | fairs, fair_rubrics, rubric_criteria | 🟡 |
| DELETE | `/api/fairs/:id/rubric/criteria/:criterionId` | A,R(ADMIN) | removeCriterion→`rubric:112` | fairs, fair_rubrics, rubric_criteria | 🟡 |
| GET | `/api/fairs/:id/projects` | A,R(ADMIN,JURY) | listApprovedProjects→`exposition:88` | fairs, fair_jury_assignments, fair_jury_category_assignments, projects | 🟡 (ADMIN) / ❌ membresía (JURY) |
| GET | `/api/fairs/:id/projects/:projectId` | A,R(ADMIN,JURY) | getProjectDetail→`exposition:130` | fairs, fair_jury_assignments, projects, users, fair_jury_category_assignments | 🟡 / ❌ (JURY) |
| GET | `/api/fairs/:id/projects/:projectId/rubric` | A,R(JURY) | getMyChecklist→`responses:97` | fairs, fair_jury_assignments, users, projects, fair_rubrics, fair_evaluations | 🟡 org en `juryCategoryAccess:63` |
| PUT | `/api/fairs/:id/projects/:projectId/rubric` | A,R(JURY) | upsertChecklist→`responses:28` | fairs, fair_jury_assignments, users, projects, fair_jury_category_assignments, fair_rubrics, fair_evaluations, fair_evaluation_details | 🟡 |
| GET | `/api/fairs/:id/evaluations` | A,R(ADMIN,JURY) | listEvaluations→`exposition:153` | fairs, fair_jury_assignments, fair_evaluations | 🟡 (ADMIN) / ❌ (JURY) |
| GET | `/api/fairs/:id/jury/declaration` | A,R(JURY) | getMyDeclaration→`exposition:225` | fairs, fair_jury_assignments, (fair_jury_declarations) | ⚠️ **ROTO:** `evaluationRepository.findDeclaration` no existe |
| POST | `/api/fairs/:id/jury/declaration` | A,R(JURY) | createMyDeclaration→`exposition:202` | fairs, fair_jury_assignments, (fair_jury_declarations) | ⚠️ **ROTO:** idem, `safeCreateDeclaration` no existe |

### 2.5 FairResults

| Método | Ruta | MW | Controller→Service | Tablas | org |
|---|---|---|---|---|---|
| GET | `/api/fairs/:id/results` | A,R(ADMIN) | getResults→`fairResult.service:7` | fairs, fair_result_publications, projects, fair_evaluations | 🟡 guard `:17-22` (403) |
| POST | `/api/fairs/:id/results/publish` | A,R(ADMIN) | publishResults→`fairResult.service:103` | fairs, fair_result_publications | 🟡 guard `:113-118` (403) |
| GET | `/api/fairs/:id/projects/:projectId` | A,R(JURY) | getProjectReview→`fairResult.service:154` | fair_jury_assignments, projects | ❌ solo membresía (sombreado por fairEvaluation en la práctica) |

### 2.6 FairEngagement 🟥

| Método | Ruta | MW | Controller→Service | Tablas | org |
|---|---|---|---|---|---|
| POST | `/api/fairs/:fairId/projects/:projectId/like` | A,R(JURY) | likeProject→`likes:39` | fair_jury_assignments, projects, fair_project_likes, project_members, fair_project_like_milestones | ❌ **sin org en todo el flujo** |
| DELETE | `/api/fairs/:fairId/projects/:projectId/like` | A,R(JURY) | unlikeProject→`likes:77` | fair_jury_assignments, fair_project_likes | ❌ |
| GET | `/api/fairs/:fairId/projects/:projectId/likes/count` | A (**cualquier rol**) | getLikeStatus→`likes:98` | projects, fair_project_likes | ❌ **fuga cross-tenant** |
| GET | `/api/fairs/:fairId/projects/:projectId/engagement` | A | getProjectEngagement→`student:61` | fairs, projects, fair_jury_assignments, project_members, fair_project_likes, fair_project_comments | ❌ **ADMIN de cualquier org** |
| POST | `/api/fairs/:fairId/projects/:projectId/comments` | A,R(JURY) | createComment→`comments:48` | fair_jury_assignments, projects, fair_project_comments, project_members | ❌ |
| GET | `/api/fairs/:fairId/projects/:projectId/comments` | A (**cualquier rol**) | listComments→`comments:82` | projects, fair_project_comments | ❌ **ADMIN ve autores de otra org** |
| PATCH | `/api/fairs/:fairId/comments/:commentId` | A | updateComment→`comments:111` | fair_project_comments | ❌ |
| DELETE | `/api/fairs/:fairId/comments/:commentId` | A | deleteComment→`comments:136` | fair_project_comments | ❌ **ADMIN borra comentario de cualquier org** |

### 2.7 FairCategories / FairStands / JuryAssignments / JuryCategoryAssignments

| Método | Ruta | MW | Service | Tablas | org |
|---|---|---|---|---|---|
| GET/POST/PUT/DELETE | `/api/fairs/:id/categories[/:categoryId]` | A,R(ADMIN,JURY) | fairCategory.service | fairs, fair_categories, projects, fair_jury_category_assignments | 🟡 ADMIN `:37-42` (403); JURY membresía |
| GET/POST/PUT/DELETE | `/api/fairs/:id/stands[/:standId]` | A,R(ADMIN,JURY) | fairStand.service | fairs, fair_stands, projects | 🟡 ADMIN `:36-41`; JURY membresía |
| GET/POST/DELETE | `/api/fairs/:id/juries[/:userId]` | A,R(ADMIN) | juryAssignment.service | fairs, fair_jury_assignments, users | 🟡 fair validada; assertSameOrganization al asignar; `getJuryAssignment` NO valida org del userId consultado |
| GET | `/api/fairs/my-assignments` | A,R(JURY) | juryAssignment.service:218 | fair_jury_assignments | ❌ scope por actor |
| GET | `/api/fairs/my-assignments/:fairId` | A,R(JURY) | juryAssignment.service:238 | fair_jury_assignments | ❌ membresía |
| GET/POST/DELETE | `/api/fairs/:id/juries/:userId/categories[/:categoryId]` | A,R(ADMIN) | fairJuryCategoryAssignment.service | fairs, fair_jury_assignments, fair_categories, fair_jury_category_assignments | 🟡 fair validada; `removeCategory` no re-verifica category↔fair |

### 2.8 Certificates

| Método | Ruta | MW | Service | Tablas | org |
|---|---|---|---|---|---|
| POST | `/api/fairs/:id/certificates/generate` | A,R(ADMIN) | generateCertificates→`certificate.service:42` | fairs, fair_result_publications, projects, project_members, certificates | 🟡 `helpers:32` 403. **⚠️ ROJO: `countVotesByProject` y `buildVoteRanking` no existen → TypeError en runtime** |
| GET | `/api/certificates/my` | A | listMyCertificates→`certificate.service:121` | certificates | ✅ scope por userId |
| GET | `/api/certificates/:certificateId` | A | getCertificateById→`certificate.service:136` | certificates | 🟡 guarda post-load (`:140-145`) |
| GET | `/api/certificates/:certificateId/pdf` | A | downloadCertificatePdf | certificates | 🟡 idem |

### 2.9 Audits

| Método | Ruta | MW | Service | Tablas | org |
|---|---|---|---|---|---|
| GET | `/api/audit/verify` | A,R(ADMIN) | verifyChain→`audit.service:62` | audit_logs (fn SQL global) | ❌ reporte global cross-tenant |
| GET | `/api/audit/logs` | A,R(ADMIN) | getAuditLogs→`audit.service:15` | audit_logs + users | ✅ JOIN `u.organization_id=$1` |
| GET | `/api/audit/logs/:id` | A,R(ADMIN) | getAuditLogById→`audit.service:44` | audit_logs | ❌ **solo por id, sin org** |
| POST | `/api/audit/logs` | A,R(ADMIN) | logAction→`audit.service:81` | audit_logs | ❌ escritura arbitraria (no fuga de lectura) |

### 2.10 Users (tenant) + Usuarios platform

| Método | Ruta | MW | Service | Tablas | org |
|---|---|---|---|---|---|
| GET | `/api/users/me` | A | getMe | users | ✅ self |
| PUT | `/api/users/me` | A | updateMyProfile | users | ✅ self |
| POST | `/api/users/me/password` | A | changeMyPassword | users | ✅ self |
| GET | `/api/users/` | A,R(ADMIN),**S**(attachScopeUserFilter) | listUsers | users, user_site_assignments | ✅ buildScopeUserWhere |
| POST | `/api/users/` | A,R(ADMIN) | createUser | users | ✅ org equality `create:81-83` |
| POST | `/api/users/bulk` | A,R(ADMIN) | createUsersBulk | users, organization_sites | ✅ org equality |
| GET | `/api/users/:id` | A,R(ADMIN), **canActorActOnUser inline** | getUserById | users | 🟡 + scope multi-sede |
| PUT | `/api/users/:id` | A,R(ADMIN),S | updateUser | users | 🟡 scope |
| PATCH | `/api/users/:id/role` | A,R(ADMIN),S | changeRole | users | 🟡 scope |
| PATCH | `/api/users/:id/status` | A,R(ADMIN),S | setActive | users | 🟡 scope |
| PATCH | `/api/users/:id/unlock` | A,R(ADMIN),S | unlockUser | users | 🟡 scope |
| DELETE | `/api/users/:id` | A,R(ADMIN),S | softDeleteUser | users | 🟡 scope middleware |
| PUT | `/api/users/:id/site` | A,R(ADMIN),S | inline | user_site_assignments, users | 🟡 |
| PUT | `/api/users/:id/academic` | A,R(ADMIN),S | updateAcademic | users | 🟡 |
| POST | `/api/users/bulk/pdf` | A,R(ADMIN), **blockSuperAdminOnTenantRoute** | bulkPdf | organizations, users | ✅ org check |
| POST | `/api/users/admin/provision` | A,R(SUPERADMIN) | provisionAdmin | users, organizations | plataforma |
| POST | `/api/users/admin/provision-existing/:organizationId` | A,R(SUPERADMIN) | provisionExistingAdmin | users, organizations | plataforma |

### 2.11 Organizations (+ requests + sites + onboarding)

| Método | Ruta | MW | Service | Tablas | org |
|---|---|---|---|---|---|
| GET | `/api/organizations/requests` | A,R(SUPERADMIN) | listRequests | organization_requests | plataforma |
| POST | `/api/organizations/requests` | **público** | createRequest | organization_requests | público |
| GET/PATCH/PATCH | `/api/organizations/requests/:id` + `/approve` + `/reject` | A,R(SUPERADMIN) | getRequestById / approvalService | organization_requests, users, organizations, invitations | plataforma |
| GET/POST | `/api/organizations/` | A,R(SUPERADMIN) | getOrganizations/createOrganization | organizations | plataforma (por diseño) |
| GET | `/api/organizations/:id` | **optionalAuth** | getOrganizationById | organizations | ❌ **público por diseño** (catálogo) |
| PATCH | `/api/organizations/:id` | A,R(ADMIN,SUPERADMIN) | updateOrganization | organizations, users | 🟡 ADMIN atado a su org (`service:113-115`) |
| DELETE | `/api/organizations/:id` | A,R(SUPERADMIN) | deleteOrganization | organizations | plataforma |
| PATCH | `/api/organizations/:id/onboarding` | A,R(**ADMIN**) | updateOnboarding | organizations | ❌ **sin check actor.org === :id** |
| POST | `/api/organizations/:id/onboarding/complete` | A,R(**ADMIN**) | completeOnboarding | organizations | ❌ idem |
| GET/POST/PUT/DELETE | `/api/organizations/sites[/:siteId]` | A,R(ADMIN,SUPERADMIN) | organizationSite.service | organization_sites, regions | ✅ ADMIN lista por `organizationId`; resto 🟡 |

### 2.12 Academic

| Método | Ruta | MW | Service | Tablas | org |
|---|---|---|---|---|---|
| GET/POST/PUT/DELETE | `/api/academic/careers[/:id]` | A,R(ADMIN,SUPERADMIN) | career.service | careers | ✅ `{ id, organizationId }` / `create` con org |
| GET/POST/PUT/DELETE | `/api/academic/courses[/:id]` | A,R(ADMIN,SUPERADMIN) | course.service | courses, careers | ✅ |
| GET/POST/PUT/DELETE | `/api/academic/faculties[/:id]` | A,R(ADMIN) | faculty.service | **faculties (global)** | ❌ **sin org — catálogo global mutable por cualquier ADMIN** |
| GET/POST/PUT/DELETE | `/api/academic/programs[/:id]` | A,R(ADMIN) | program.service | **programs (global)** | ❌ idem |
| GET/POST/PUT/PATCH/DELETE | `/api/academic/periods[/:id/active]` | A,R(ADMIN) | period.service | **academic_periods (global)** | ❌ **setActivePeriod toca TODOS los tenants** |
| GET/POST/PATCH/DELETE | `/api/academic/voter-registries[/:id]` + `/sync-sis` | A,R(ADMIN) | voter-registry.service | **voter_registries (global)** + `sync_sis_voters()` | ❌ **padrón electoral de todos los tenants** |
| GET | `/api/academic/evaluation-careers` | A,R(ADMIN,SUPERADMIN), **inline prisma** | inline `prisma.career.findMany` | careers | ✅ orgScope |
| GET | `/api/academic/evaluation-courses` | A,R(ADMIN,SUPERADMIN), **inline prisma** | inline `prisma.course.findMany` | courses | ✅ orgScope |
| POST/GET/DELETE | `/api/academic/teaching-assignments[/:id]` | A,R(ADMIN,SUPERADMIN) | teachingEvaluation.service | careers, courses, users, academic_periods, teaching_assignments | ✅ org en selects/creates; period sin org (`assertOrganization` previo) |
| GET | `/api/academic/my-teaching-assignments` | A,R(STUDENT) | listAssignmentsForStudent | users, teaching_assignments | ✅ org del student |
| POST | `/api/academic/teacher-evaluations` | A,R(STUDENT) | evaluateTeacher | teaching_assignments, users, teacher_evaluations | ✅ org del assignment |
| GET | `/api/academic/teachers/:teacherId/evaluation-summary` | A,R(ADMIN,SUPERADMIN,TEACHER) | teacherSummary | teacher_evaluations, courses | ✅ org |
| GET (x5) | `/api/academic/evaluation-results/teacher/:teacherId/{summary,criteria,distribution,comments,evolution}` | A,R(ADMIN,SUPERADMIN,TEACHER) | evaluationResults.service | users, evaluation_responses, evaluation_response_details, teaching_assignments, evaluation_criteria | ✅ validateTeacherAccess + org nested |
| POST/GET/GET/PUT/PATCH/DELETE | `/api/academic/evaluation-criteria[/:criterionId][/toggle]` | A,R(ADMIN,SUPERADMIN) | evaluationCriteria.service | evaluation_criteria | ✅ org |
| POST/GET/PATCH/DELETE/POST | `/api/academic/evaluation-responses[...]` | A + R(STUDENT) parciales | evaluationResponse.service | teaching_assignments, users, evaluation_responses | 🟡 (respuestas sin org; aislamiento vía studentId/assignment) |
| PUT/DELETE/GET | `/api/academic/evaluation-responses/:responseId/details[...]` | A | evaluationResponseDetail.service | evaluation_responses, evaluation_criteria, evaluation_response_details | 🟡 ownership + org del criterio vs assignment |

### 2.13 Notifications / AdminScope / Translations / Upload / Auth / Health

| Método | Ruta | MW | Service | Tablas | org |
|---|---|---|---|---|---|
| GET | `/api/notifications/unread-count` | A | getUnreadCount | notifications | ✅ userId token |
| GET | `/api/notifications/` | A | listNotifications | notifications | ✅ userId token |
| POST | `/api/notifications/` | A,R(ADMIN) | createNotification | notifications, notification_deliveries | ❌ **user_id del body sin check org** |
| PATCH | `/api/notifications/mark-all-read` | A | markAllAsRead | notifications | ✅ userId |
| PATCH | `/api/notifications/:id` | A | updateNotification | notifications | ✅ compound `{id,userId}` |
| GET | `/api/admin/admins` | A,R(ADMIN) | inline + buildScopeUserWhere | users, user_site_assignments, regions | ✅ org |
| POST | `/api/admin/admins` | A,R(ADMIN) | canCreateScope + createUser | users, organization_sites | ✅ org equality + scope |
| PATCH | `/api/admin/admins/:id/scope` | A,R(ADMIN) | inline | users, user_site_assignments | ✅ target org check |
| PUT | `/api/admin/admins/:id/sites` | A,R(ADMIN) | assignSiteScopes | users, user_site_assignments | 🟡 vía service |
| DELETE | `/api/admin/admins/:id` | A,R(ADMIN) | inline | users | ✅ target org check |
| GET | `/api/admin/sites` | A,R(ADMIN) | resolveAccessibleSites | organization_sites, regions | ✅ scope |
| GET | `/api/platform/translations/dictionary` | **público** | getUiTranslations | platform_translations | público |
| GET | `/api/platform/translations/effective-locale/:userId` | A,R(ADMIN) | getEffectiveLocale | platform_translations, users | ❌ **:userId arbitrario** |
| GET/POST/PUT/PATCH/DELETE | `/api/platform/translations[...]` | A,R(ADMIN) | PlatformTranslation.service | platform_translations | ❌ diccionario global editable |
| POST | `/api/upload/` + `/api/upload/logo` | A | inline | media_files | ✅ userId (self) |
| POST/GET/PUT/POST/POST/... | `/api/auth/*`, `/api/auth/otp/*`, `/api/auth/onboarding/*` | mixtos | auth services | users, refresh_tokens, one_time_tokens, activations, mfa | self / público |
| GET | `/api/health` + `/api/health/db` | **público** | health.controller | (pg) | n/a |

---

## 3. Matriz de Clasificación de Tablas por Riesgo

### 🟢 Bajo riesgo — `organization_id` directo y SIEMPRE filtrado
| Tabla | Módulos que la consultan | Evidencia |
|---|---|---|
| `organizations` | org, users, adminScope | CRUD platform + `:id` admin bound |
| `organization_sites` | orgSite, fairs, users | ✅ filtro org |
| `regions` | orgSite, adminScope | vía join sites |
| `users` | users, adminScope, académico | ✅ org + scope multi-sede |
| `fairs` | fairs, projects, voting, evaluation, categories, stands, jury, results, certificate | ✅ org en makespace/guards |
| `projects` | projects, voting, evaluation, results, certificate, engagement | ✅ org directa + guards |
| `careers` | career, teachingEvaluation | ✅ |
| `courses` | course, teachingEvaluation | ✅ |
| `teaching_assignments` | teachingEvaluation | ✅ |
| `teacher_evaluations` | teachingEvaluation | ✅ |
| `evaluation_criteria` | teachingEvaluation | ✅ |
| `certificates` | certificate | 🟡 guarda post-load (userId/org) |

### 🟡 Riesgo medio — sin `organization_id`; JOIN al tenant es obligatorio/derivable
| Tabla | Vía de aislamiento (FK/JOIN) | Presencia de fallos |
|---|---|---|
| `fair_votes` | fair_id → fairs.org | ✅ bien resguardada en voting/results (guard org) |
| `fair_vote_participation` | fair_id → fairs.org | ✅ idem |
| `fair_evaluations` | fair_id/project_id → fairs.org | ✅ org en access helpers |
| `fair_evaluation_details` | evaluation_id → fair_evaluations | ✅ por cadena |
| `fair_rubrics` / `rubric_criteria` | fair_id → fairs.org | ✅ |
| `fair_categories` | fair_id → fairs.org | ✅ |
| `fair_stands` | fair_id → fairs.org | ✅ |
| `fair_jury_assignments` | fair_id → fairs.org | 🟡 invariancia garantiza org (asignación require misma org) |
| `fair_jury_category_assignments` | jury_assignment_id → fair | 🟡 |
| `fair_jury_declarations` | fair_id → fairs.org | ⚠️ endpoints rotos (repositorio faltante) |
| `fair_result_publications` | fair_id → fairs.org | ✅ |
| `project_members` | project_id → projects.org | ✅ |
| `user_site_assignments` | user_id → users.org | ✅ |
| `evaluation_responses` | teaching_assignment_id → org | ✅ ownership student |
| `evaluation_response_details` | evaluation_response_id | ✅ |
| `media_files` | user_id | ✅ self |
| `notifications` | user_id | ❌ **POST admite user_id de otro tenant** |
| `refresh_tokens` / tokens | user_id | ✅ self |

### 🔴 Alto riesgo — sin `organization_id` ni aislamiento efectivo
| Tabla | Problema | Evidencia |
|---|---|---|
| `voter_registries` | CRUD + sync global; sin actor en service | `voter-registry.service.js:7-91`, repo sin org |
| `faculties` | catálogo global mutable | `faculty.service.js:5-65` |
| `programs` | catálogo global mutable | `program.service.js:19-64` |
| `academic_periods` | global; `setActivePeriod` desactiva períodos de todos los tenants | `period.repo:72` |
| `audit_logs` | `GET /logs/:id` y `verify` sin filtro org | `audit.repo:107-126,182` |
| `platform_translations` | diccionario global editable + `effective-locale/:userId` | `PlatformTranslation.service.js:37-115` |

---

## 4. Rutas SIN middleware tenantScope que consultan tablas 🔴 o 🟡

> `requireFairInScope`/`requireProjectInScope` existen (`middlewares/scope.middleware.js`) pero **no se montan en ninguna ruta**. Ningún router de FERIAS usa middleware de scope; toda la protección vive en los services.

| Ruta | Tabla(s) | Riesgo | Por qué |
|---|---|---|---|
| `GET /api/fairs/:fairId/voting/status` | fair_vote_participation 🟡 | ⚠️ | Solo valida membresía JURY; sin compare org (fair validada solo por asignación). Riesgo bajo (solo vería `hasVoted` de la feria a la que está asignado) |
| `GET /api/fairs/my-evaluations` | fair_evaluations 🟡 | ⚠️ | Scope por propio `juryUserId` — bajo riesgo |
| `GET /api/fairs/my-progress/:fairId` | projects, fair_evaluations 🟡 | ⚠️ | Solo membresía |
| `GET/POST/DELETE /api/fairs/**/like|likes/count|engagement|comments` (8 rutas) | fair_project_likes, fair_project_comments 🟡 | 🔴 | **Cero validación de org** — C1 |
| `GET /api/fairs/my-assignments[/:fairId]` | fair_jury_assignments 🟡 | ⚠️ | Solo actor-scope |
| `GET /api/fairs/:id/projects/:projectId` (fairResult JURY) | projects 🟡 | ⚠️ | Solo membresía |
| `GET /api/audit/verify` | audit_logs 🔴 | 🔴 | Reporte global (C3) |
| `GET /api/audit/logs/:id` | audit_logs 🔴 | 🔴 | Lectura por id sin org (C3) |
| `POST /api/audit/logs` | audit_logs 🔴 | ⚠️ | Escritura arbitraria |
| `POST /api/notifications` | notifications 🟡 | 🔴 | user_id de otro tenant (C4) |
| `GET/POST/PUT/PATCH/DELETE /api/academic/faculties|programs|periods|voter-registries` (23 rutas) | 🔴 | Aislamiento inexistente (C2) |
| `PATCH/POST /api/organizations/:id/onboarding*` | organizations | 🔴 | Sin check actor.org === :id (C5) |
| `GET/POST/PUT/PATCH/DELETE /api/platform/translations` + `effective-locale/:userId` | platform_translations 🔴 | 🔴 | Fuga + modificación global (C6) |
| `POST /api/fairs/:id/certificates/generate` | certificates 🟡 | 🔴 | **Código roto** (TypeError) — se cae antes de escribir; plus deuda de mantenimiento |

---

## 5. Conclusiones del Mapeo (para 15.2/15.3/15.4)

1. **CERO queries** de los módulos de FERIAS/VOTACIÓN/EVALUACIÓN filtra por `organizationId` en el WHERE de Prisma: el aislamiento se delega 100% a guards en service (patrón `SE-VALIDA-ANTES`) o a la invariancia de `fair_jury_assignments`. No hay RLS.
2. **Dos tablas 🔴 con escritura cross-tenant directa:** `faculties`/`programs`/`academic_periods`/`voter_registries` (global) y `platform_translations` (global).
3. **9 archivos de service FERIAS** repiten el mismo guard `fair.organizationId !== actor.organizationId` (→ `fairCategory:37`, `fairStand:36`, `juryAssignment:47`, `fairJuryCategoryAssignment:32`, `fairVoting.results:19`, `fairResult:17`, `certificate.helpers:25`, `fairEvaluation.access:25`, `juryCategoryAccess:63`) — candidatos a helper compartido (FASE 15.4).
4. **Enlaces rotos en producción:** `certificate.eligibility.service.js:42,46` (funciones inexistentes) y `fairEvaluation` declaration endpoints (`findDeclaration`/`safeCreateDeclaration` no existen en el repositorio).
5. Siguiente sub-fase: **FASE 15.2 — Auditoría de middlewares**.