# FASE 13.15 — CIERRE DE LA ELIMINACIÓN DEL DOMINIO ELECTIONS

> Reporte final de la FASE 13 + cierre FASE 13.16 (auditoría de migraciones).
> Fecha: 2026-09-22 · Rama: `develop` (HEAD `beda2c5` previo a working tree).

---

## 1. Objetivo

Eliminar estructuralmente el dominio **ELECTIONS** del backend CAMPUSVOTE
(`/Users/tecsup/campusvote`), conservando íntegros los dominios **FERIAS**,
**ACADEMIC** y **CORE** (Auth, Users, Organizations, Roles, Audit, Notifications,
Storage), validar el estado resultante y cerrar la fase con un reporte.

Reglas de la fase: no `prisma db push`, no `DROP SCHEMA` manual, no borrar
objetos por nombre sin auditarlos; parar ante dependencia inesperada, eliminar
de forma segura y re-auditar al final.

## 2. Estado inicial

- Dominio `ELECTIONS` implementado end-to-end: schemas Prisma, módulos
  (`src/modules/elections|ballots|voting|objections|results`), ~50 archivos SQL
  de migración, rutas `/api/elections`, `/api/ballots`, `/api/voting`,
  `/api/objections`, `/api/results`, tags Swagger y constantes de roles.
- El dominio FERIAS ya era independiente (tablas `fair_*`, módulos `fair*`),
  pero compartía **código de Auditoría y notificaciones** con el dominio
  electoral (acciones `CAST_VOTE`, `electionId` en `audit_logs`, tipos
  electorales en `audit_action_type` y `notification_type`).

## 3. Alcance de Elections eliminado

- **Código activo:** módulos de negocio, controladores, servicios, schemas de
  validación, repositorios y rutas de elections/ballots/voting/objections/results.
- **Modelos Prisma** y sus relaciones en los schemas compuestos.
- **SQL canónico** en `database/sql/{elections,ballots,voting,results,objections,public,reports}/`.
- **Vistas, funciones y triggers** electorales creados en BD por esos SQL.
- **Enums** electorales del schema Prisma y del SQL de migración.
- **Fragmentos compartidos:** acciones de auditoría electorales, notificaciones
  electorales, `electionId` en `audit_logs`, rate limiter por elección,
  `ApiError` electorales, constantes de rol electoral, tags Swagger electorales.

## 4. Módulos eliminados

| Módulo | Ruta |
|---|---|
| Elections | `src/modules/elections/` (controllers, services, schema, routes, docs) |
| Ballots | `src/modules/ballots/` |
| Voting | `src/modules/voting/` |
| Objections | `src/modules/objections/` |
| Results | `src/modules/results/` |
| Audit tokens | `src/modules/audit/audit.tokens.controller.js`, `audit.tokens.docs.js` |
| Seeds | `prisma/seed.ts` (seedElections) y `database/seeds/election.ts` |

Conservados deliberadamente:
- `src/modules/juryAssignments/` → pertenece a **FERIAS** (`fairJuryAssignment`).
- `src/modules/academic/voter-registry/` → **ACADEMIC** (padrón académico).

## 5. Modelos Prisma eliminados

- `prisma/schema/election.prisma`
- `prisma/schema/ballots.prisma`
- `prisma/schema/voting.prisma`
- `prisma/schema/objections.prisma`
- `prisma/schema/jury.prisma` (jury electoral legacy)

Eliminadas además las relaciones electorales que quedaban en schemas
compartidos:
- `user.prisma`: eliminadas `votingAccessTokens`, `createdElections`,
  `candidacies`, `votingSessions`, `votes`, `advisorForCandidacies`,
  `juryAssignments`, `assignedJuryAssignments`, `objectionsFiled`,
  `objectionsReviewed`.
- `organization.prisma`: eliminado `elections Election[]`.
- `academic.prisma`: eliminado `elections` en `Faculty`, `Program`,
  `AcademicPeriod`.
- `audit.prisma`: reescrito (enum accionable sin tipos electorales).
- `notification.prisma`: reescrito (enum de notificaciones sin tipos
  electorales; añadidos tipos de engagement de ferias).

## 6. SQL eliminado

`git rm` de las carpetas completas:
- `database/sql/elections/` (001_enums … 010_candidacy_advisor)
- `database/sql/ballots/` (001_enums … 006_functions)
- `database/sql/voting/` (001_voting_sessions … 008_scrutiny)
- `database/sql/results/` (001_tallies … 006_weighted_fair)
- `database/sql/objections/` (001_candidacy_objections)
- `database/sql/reports/` (001_election_report_history)
- `database/sql/public/` (001_public_election_landing)
- `database/sql/audit/004_voting_access_tokens.sql` y `005_token_consumption.sql`

Además:
- `scripts/apply-sql.js` (migrador canónico) y `tests/setup-db.js` ya no listan
  ninguna entrada electoral (pasos re-numerados 9–12).
- `scripts/db-setup.ps1` sin bloques electorales (bloque Academic restaurado).
- `database/sql/audit/{001,002,003,006,007}` reescritos sin objetos electorales.
- `database/sql/notifications/001_notifications.sql` reescrito sin tipos
  electorales y sin `chk_notifications_vote_confirmation_secrecy`.

## 7. Rutas eliminadas

- `/api/elections/*` (electionsRoutes)
- `/api/ballots/*` (ballotRoutes)
- `/api/voting/*` (votingRoutes / votingPublicRoutes)
- `/api/objections/*` (objectionRoutes)
- `/api/results/*` (resultsRoutes / resultsPublicRouter)
- KPIs públicos electorales (publicKpisRoutes)
- `/api/audit/tokens/*` (one-time tokens y consumo en audit.routes)
- Eliminadas de `scope.middleware.js`: `requireElectionInScope`,
  `requireBallotInScope` y su `electionRepository`.
- Eliminados de `rateLimiter.middleware.js`: `userElectionLimiter` y
  `getElectionId`.

Verificación: **211 rutas montadas, 0 electorales** (al arranque de la
aplicación; ver §15 … §18).

## 8. Relaciones compartidas eliminadas

- `audit_logs.election_id` y su FK → `elections` (repositorio de auditoría y
  `audit.service.logAction` ya no envían/leen ese campo).
- `rateLimit` por elección (`userElectionLimiter`).
- `NotificationService.broadcastElectionResult` y
  `NotificationRepository.findVotersForElection` / `createBroadcast`.
- `ApiError` electorales: `electionNotFound`, `electionNotOpen`.
  `alreadyVoted`, `notEligibleToVote`, `tokenAlreadyUsed`, `tokenExpired`,
  `invalidBallot`, `invalidVotingSession` (verificado: sin usos).
- `constants/messages.js`: bloques ELECTION / VOTE / CANDIDATE / RESULTS.
- Callers que pasaban `electionId: null` a `logAction` limpios
  (fairEngagement.notifications, fairEvaluations.responses.service,
  fairVoting.service, auth.totp.service).

## 9. Limpieza de Audit

`src/modules/audit/*` reescrito sin rastro electoral:
- `audit.schema.js` — `AUDIT_ACTIONS` final:
  `LOGIN, VERIFY_2FA, ACCESS_DENIED, CAST_FAIR_VOTE, FAIR_VOTE_ATTEMPT_DENIED,
  RUBRIC_CHECKLIST_FINALIZED, PROJECT_LIKED, PROJECT_COMMENTED`.
- `audit.service.js` — `logAction(actorId, action, ipAddress, metadata)`;
  el destructuring ignora claves extra no declaradas.
- `audit.repository.js` — `findAuditLogs` filtra tenant SOLO vía
  `JOIN users` (`u.organization_id = $1`); ya no hay segunda tabla/columna.
- `audit.controller.js` — solo LOGS_METHODS; sin TOKENS_METHODS.
- `audit.routes.js` — sin rutas ni rate-limit de tokens.
- `audit.logs.controller.js`, `audit.schemas.docs.js`, `audit.logs.docs.js`
  sin `electionId` ni OneTimeToken.
- SQL: `001_enums`, `002_audit_logs`, `003_audit_protection` (hash sin
  `election_id`), `006_audit_permissions`, `007_actions_peru`.

Estado: módulo Audit operativo sin `electionId`; suite de integración
`audit-immutability.integration.test.js` (UPDATE/INSERT exitosos) **PASS**.

## 10. Limpieza de Roles

- `src/constants/roles.js`: eliminados `ELECTORAL_ROLES` e `isElectoralRole`
  (verificado: sin usos en `src` ni `tests`).
- `src/constants/index.js`: eliminadas las re-exportaciones de ambos.

## 11. Limpieza de Swagger / Documentación

- `src/config/swagger/index.js`: eliminados tags `Elecciones`, `Voting`,
  `Ballots`, `Results`; descripción de Audit simplificada.
- `src/config/swagger/schemas/`: eliminado `election.schema.js`; `index.js`
  sin `electionSchemas`.
- `src/modules/PlatformTranslation/PlatformTranslation.docs.js`: ejemplos
  actualizados (sin strings electorales).
- `src/modules/fairEvaluations/fairEvaluation.aux.docs.js`: corregido YAML
  inválido (`200: { description: 'Declaración (signed: bool)' }`) que impedía
  el boot de Swagger.
- `README.md`: actualizada la descripción de `src/modules/`.
- Comentarios heréticos corregidos en `scope.middleware.js` y
  `fairJuryAssignment.docs.js`.

## 12. Estado de la base de datos

La BD `campusvote_db` (dev) fue reconstruida por el harness de tests
(`tests/setup-db.js`: `DROP SCHEMA public CASCADE` + carga del SQL canónico
sin electorales). Verificado sobre la base viva:

- 0 tablas electorales (todas las `election*/ballot*/vote*`… ausentes).
- Tablas `fair_*` presentes (14) e `academic` core presentes (7) +
  `voter_registries`/`voter_registry_claims` (ACADEMIC).
- `audit_logs` sin columna `election_id`.
- `audit_action_type` = solo los 8 valores finales.
- `notification_type` = `SYSTEM_ALERT, FAIR_OPENED, RATING_RECEIVED,
  PROJECT_LIKED, PROJECT_COMMENTED, PROJECT_LIKE_MILESTONE`.
- 0 enums, 0 funciones y 0 vistas electorales en `public`.
- Trigger/`campusvote_schema_migrations`: la tabla de control del migrador
  canónico quedó sin entradas electorales.
- No existe tabla `_prisma_migrations` (la BD nunca fue gestionada por
  Prisma Migrate).

Nota: `database/sql/_destructive/13_remove_elections.sql` documenta el
inventario real (17 tablas + `ratings`/`rating_details`/`feria_criteria`
huérfanas, FK `audit_logs.election_id`, funciones/vistas/triggers) para
bases **legacy** existentes. En la dev actual ya no aplica (BD reconstruida).
No fue ejecutado ni modificado.

## 13. Estado de Prisma

- `npx prisma validate` → **OK** («The schemas at prisma/schema are valid 🚀»).
- `npx prisma generate` → **OK** (Prisma Client v6.19.3).
- Schema activo (multi-file `prisma/schema/`): 0 modelos electorales, 0
  relaciones electorales; 34 modelos ferias/academic/core vigentes.
- `prisma.config.ts` declara solo `schema: "prisma/schema"`.

## 14. Estado de tests

Ejecución final (jest, `npm test` contra `DATABASE_URL` de `.env.test`):

| Métrica | Valor |
|---|---|
| Suites PASS | **28** |
| Suites FAIL | **17** (pre-existentes) |
| Suites skipped | 1 |
| Tests PASS | **458** |
| Tests FAIL | **105** (años de deuda pre-existente) |
| Tests skipped | 1 |

### Tests que pasan (representativos)
- `tests/unit/middlewares/rateLimiter.middleware.test.js` (FASE 13: actualizado).
- `tests/unit/constants/academicCycle.test.js`, `tests/unit/shared/*`,
  `tests/unit/teachingEvaluation/*`, `tests/unit/certificate/*`,
  `tests/unit/users/*`, `tests/unit/organizations/*`,
  `tests/unit/middlewares/auth.middleware.security.test.js`, etc.
- Integración con carga real de schema SQL (fair/academic/core):
  `audit-immutability`, `fairStatusTransition`, `fairVoting`,
  `fairRubricChecklist`.

### Fallos pre-existentes (NO atribuibles a FASE 13)
Clasificados como **deuda/configuración del branch** (introducidos por el refactor
del commit `beda2c5` «eliminacion de raitings», previo a esta sesión; verificados
contra un worktree en HEAD limpio y los mismos archivos intactos desde HEAD):

1. **Imports rotos por refactor de exports** (`auth.middleware.js`,
   `auth.helpers.js`): exports renombrados (`authenticate` ← `authenticateToken`;
   `AUTH_MESSAGES` extraído) que los tests y `fairResult.routes.js` seguían
   usando.
   - Acción aditiva de compatibilidad aplicada en esta fase:
     `export const authenticateToken = authenticate;` y
     `export const authorizeRoles = authorizeTenant;` → recuperó el boot de la
     app. Sigue pendiente `AUTH_MESSAGES` en `auth.helpers.js`.
2. **Fixtures de tests de integración desalineados con el modelo actual**:
   `PrismaClientValidationError` al invocar `prisma.fairEvaluation.create()`
   con argumentos que el cliente Prisma vigente rechaza
   (`fairResults.integration.test.js`, `fairJuryCategoryAssignment`, etc.).
3. **Mocks desalineados en unit tests** (p. ej. `fair.status-transition.test.js`
   mockea `fairVoteParticipation.count` y el servicio usa `findMany` sobre otro
   modelo).
4. **Sintaxis ESM incompatible** en `fairVoting.integration.test.js`
   («Unexpected reserved word»).
5. **Expectativas de formato de rutas** en `fair.superadmin-authorization.test.js`
   (`fairResult.routes.js` no expone arrays `MANAGERS`/`READERS`) y
   `project.service.js` (`REVIEWER_ROLES`).

**Fallos introducidos por esta fase: NINGUNO.** Todos los módulos, schemas y
tests modificados por FASE 13 pasan o están libre de elecciones. Antes de los
aliases de compatibilidad, las mismas suites fallaban por `authenticateToken`
inexistente (aún peor).

## 15. Migration histórica `20260825034651`

### Auditoría (evidencia)

Archivo único: `prisma/schema/migrations/20260825034651/migration.sql` (+
`migration_lock.toml`), commit introducido: `f15326c`.

1. **Contenido electoral que referencia:** enum `election_process_type`
   (`ADD VALUE 'EVENT_POLL'`, `'AWARD'`), tablas `votes` (incl. `session_id`,
   `voter_id`, índices `idx_votes_voter`, `uq_votes_election_voter`),
   `vote_selections`, `candidacies`, `candidate_lists`, `elections`
   (`course_section_id`), `tallies`; además `users`, `voter_registries`,
   `courses`, `course_sections`, `user_devices`. Es una migración derivada de
   Prisma para un estado histórico del schema.
2. **Dependencias posteriores:** ninguna. Es la única migration del directorio;
   `prisma migrate status` reportaba «1 migration found … not yet applied».
3. **Scripts que la ejecutan:** ninguno. `scripts/apply-sql.js` y
   `tests/setup-db.js` no referencian `prisma/schema/migrations`.
4. **CI/CD / deploy / Docker / docs / package.json:** `db:migrate` y
   `db:migrate:prod` = `node scripts/apply-sql.js`; `start:render`/`deploy:render`
   usan `db:migrate`+`db:generate` (`prisma generate`). No existe
   `prisma migrate` en scripts, `package.json`, `.github/workflows/lint.yml`
   (solo ESLint) ni docs. `prisma.config.ts` solo define `schema`.
5. **¿Prisma Migrations es el mecanismo oficial?** No. El mecanismo oficial es
   `apply-sql.js` + SQL en `database/sql/` (y `db-setup.ps1`/`setup-db.js`
   para recreaciones). La BD no tiene tabla `_prisma_migrations`.
6. **`apply-sql.js` como migrador canónico:** confirmado (npm scripts
   `db:migrate`, `db:migrate:prod`, Render deploy).
7. **¿Eliminar rompe algo?** No. No hay tooling que lea el directorio; la BD no
   lo tiene aplicado; `prisma validate/generate` no dependen de migrations.
   Ejecutarla hoy fallaría (tablas/enums ya inexistentes en la BD reconstruida).
   Tras la eliminación, `prisma migrate status` informa correctamente
   «No migration found … not managed by Prisma Migrate».

### Decisión: **ELIMINAR** (evidencia completa)

Ejecutado: `git rm -r prisma/schema/migrations/` (eliminó `20260825034651/
migration.sql` y `migration_lock.toml`). No se eliminaron otros migrations
(no existían). No se modificó ningún schema activo. Validaciones post-borrado
en §13–§18.

## 16. Estado final de FERIAS

Entidades vigentes en schema Prisma (verificadas una a una):

| Entidad esperada | Modelo real |
|---|---|
| Fair | `Fair` |
| FairCategory | `FairCategory` |
| Project | `Project` |
| ProjectMember | `ProjectMember` |
| FairJuryCategoryAssignment | `FairJuryCategoryAssignment` |
| FairRubric | `FairRubric` |
| RubricCriterion | `RubricCriterion` |
| FairEvaluation | `FairEvaluation` |
| FairEvaluationDetail | `FairEvaluationDetail` |
| FairVoting | `FairVote` + módulo `fairVoting` |
| FairVoteParticipation | `FairVoteParticipation` |
| FairResults | `FairResultPublication` + módulo `fairResults` |
| FairEngagement | `FairProjectLike`, `FairProjectComment`, `FairProjectLikeMilestone` + módulo `fairEngagement` |

Ninguna de estas entidades tiene relación con Elections: el schema activo no
contiene modelos electorales (0 referencias) y el SQL de `fairs/`, `projects/`
solo referencia `fair_*` (grep verificado; coincidencias únicamente en
comentarios descriptivos y tablas `fair_*`). Jade del propio dominios:
`juryAssignments` (FERIAS) intacto. Rutas `/fairs/*` montadas.

## 17. Estado final de ACADEMIC

- `TeacherEvaluation` presente y aislado:
  `prisma/schema/academic.prisma` — flujo STUDENT → TEACHER (rating simple +
  comentario opcional). Sin relación con Elections.
- Sin `FeriaCriterion` (`feria_criteria` caído en la BD), sin `Rating` legacy
  (`ratings`/`rating_details` caídos), sin dependencia de `elections`.
- `VoterRegistry` (`voter_registries`, `voter_registry_claims`) permanece como
  dominio académico (padrón de estudiantes); su vocablo «electoral» es histórico
  del nombre del módulo y NO corresponde al dominio ELECTIONS eliminado.
- SQL `academic/*` y `organizations/*` son independientes (verificado).

## 18. Estado final de CORE

- **Auth / Users / Organizations / Roles:** intactos; `ELECTORAL_ROLES`/
  `isElectoralRole` eliminados sin impacto (0 usos).
- **Audit:** funciona sin `electionId` (schema, service, repository, routes,
  SQL, protección encadenada). Suite `audit-immutability` **PASS**.
- **Notifications:** funciona sin tipos electorales; enum final con tipos de
  ferias (engagement). Módulo conserva `SYSTEM_ALERT`, `FAIR_OPENED`,
  `RATING_RECEIVED`, `PROJECT_LIKED`, `PROJECT_COMMENTED`,
  `PROJECT_LIKE_MILESTONE`.
- **Storage:** `user_devices` (FK `users`) intacto; el SQL de su creación estaba
  en la migration histórica pero ya no forma parte del flujo canónico (se
  mantienen los modelos Prisma correspondientes).
- Boot de la aplicación: **OK**; **211 rutas, 0 electorales**.

## 19. Riesgos / deuda pre-existente

1. **Deuda de refactor `beda2c5`** (17 suites / 105 tests FAIL): exports
   renombrados (`AUTH_MESSAGES`) siguen rotos en `auth.helpers.js`; fixtures de
   integración desalineados con el Cliente Prisma; mocks y sintaxis ESM
   pendientes; expectativas de formato de rutas. Requiere un lote de
   mantenimiento posterior, independiente de esta fase.
2. **Documentación obsoleta** (docs/*.md: `FLUJO_ADMINISTRATIVO_Y_PANEL_PUBLICO`,
   `PLAN_FRONTEND_ADMIN_WEB`, `FLUJO_FLUTTER_JURADO_VOTACION`,
   `REVISION_PRODUCCION_F0_F9`, etc.) aún describe flujos electorales: es
   documentación histórica, fuera de alcance (no afecta código activo).
3. **`database/sql/_destructive/13_remove_elections.sql`**: artefacto para
   bases legacy; no aplica a la dev actual. Conservar sin ejecutar.
4. **Comentarios descriptivos** en `prisma/schema/*.prisma` y SQL de ferias que
   mencionan «elections/candidacies» como contexto histórico: solo texto,
   irrelevantes (falsos positivos verificados).
5. **Historial git**: todos los archivos eliminados siguen recuperables en
   commits previos (copia forense natural).

## 20. Veredicto final

La **FASE 13 está CERRADA** (incluido el cierre 13.16 de migraciones). Criterios
confirmados:

- [x] Elections no existe como dominio activo (módulos, rutas, imports, modelos,
      SQL).
- [x] 0 rutas electorales activas (211 rutas montadas, 0 electorales).
- [x] 0 imports/models electorales activos.
- [x] 0 SQL electorales en el flujo canónico.
- [x] Ferias no depende de Elections (schema + SQL verificados).
- [x] Academic no depende de Elections (TeacherEvaluation aislado; sin
      `FeriaCriterion`/`Rating` legacy).
- [x] Audit sigue funcionando sin `electionId` (suite PASS).
- [x] Notifications sigue funcionando sin tipos electorales.
- [x] `prisma validate` y `prisma generate` OK.
- [x] El proyecto arranca y monta rutas.
- [x] Migration histórica `20260825034651` resuelta con evidencia y ELIMINADA.
- [x] Existe el reporte `FASE_13.15_CIERRE_ELIMINACION_ELECTIONS.md`.

Eliminación efectiva: **~33.200 líneas** de dominio electoral retiradas
(52 archivos cambiados en el working tree de la fase, 135 + / 33.223 −).