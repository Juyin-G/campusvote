# Lógica de Negocio — Backend CampusVote

Documento de referencia con la lógica de negocio de **todo** el backend (Express + Prisma + PostgreSQL).

Alcance: `src/modules/*`, `prisma/schema/*`, `database/sql/*`.

---

## Índice
1. [Panorama del dominio](#1-panorama-del-dominio)
2. [Organizaciones y on-boarding](#2-organizaciones-y-on-boarding)
3. [Usuarios y autenticación](#3-usuarios-y-autenticación)
4. [Académico (facultades, programas, períodos, padrón)](#4-académico)
5. [Elecciones (workflow de estados)](#5-elecciones)
6. [Candidaturas (listas y proyectos)](#6-candidaturas)
7. [Papeleta (ballots)](#7-papeleta)
8. [Votación](#8-votación)
9. [Resultados (conteo, certificación, publicación)](#9-resultados)
10. [Ferias/concursos: proyectos, imágenes, comentarios y búsqueda](#10-feriasconcursos)
11. [Auditoría y tokens de votación](#11-auditoría)
12. [Notificaciones](#12-notificaciones)
13. [Upload (media files)](#13-upload)
14. [i18n de la plataforma](#14-i18n)
15. [Reglas transversales](#15-reglas-transversales)

---
# PARTE II — PLAN DE ADAPTACIÓN AL CONTEXTO PERUANO
- [16. Decisiones de negocio tomadas](#16-decisiones-de-negocio-tomadas)
- [17. Hallazgos en el código real](#17-hallazgos-en-el-código-real)
- [18. Fase 0 — Fundaciones transversales](#18-fase-0--fundaciones-transversales)
- [19. Fase 1 — Identidad peruana (DNI/CE)](#19-fase-1--identidad-peruana-dnice)
- [20. Fase 2 — Voto ponderado y quórum diferenciado](#20-fase-2--voto-ponderado-y-quórum-diferenciado)
- [21. Fase 3 — Tachas e impugnaciones electorales](#21-fase-3--tachas-e-impugnaciones-electorales)
- [22. Fase 4 — Rúbricas multicriterio (spec técnica)](#22-fase-4--rúbricas-multicriterio-spec-técnica)
- [23. Fase 5 — Asignación de jurados, conflicto de interés y doble ciego](#23-fase-5--asignación-de-jurados-conflicto-de-interés-y-doble-ciego)
- [24. Fase 6 — Voto popular 80/20 (People's Choice)](#24-fase-6--voto-popular-8020-peoples-choice)
- [25. Fase 7 — Reglas de desempate](#25-fase-7--reglas-de-desempate)
- [26. Fase 8 — Catálogo de categorías OCDE/CONCYTEC](#26-fase-8--catálogo-de-categorías-ocdeconcytec)
- [27. Fase 9 — 2FA por SMS/WhatsApp (baja prioridad)](#27-fase-9--2fa-por-smswhatsapp-baja-prioridad)
- [28. Orden de trabajo](#28-orden-de-trabajo)
- [29. Chequeo de planteamientos adicionales](#29-chequeo-de-planteamientos-adicionales)
- [30. Estado de implementación (build F0–F9)](#30-estado-de-implementación-build-f0f9)

---

## 1. Panorama del dominio

CampusVote es un sistema **multi-tenant**: una `Organization` (universidad/instituto/empresa) agrupa usuarios y define branding, dominios de correo permitidos, país/zona horaria e idioma. Los procesos son `Election` con un ciclo de vida rígido.

Roles (`src/constants/roles.js`):
`STUDENT`, `TEACHER`, `ADMIN`, `SUPERADMIN`, `ELECTORAL_COMMISSION`, `OBSERVER`, `JURY`

Agrupaciones de uso en rutas:
- `GESTORES` (gestionan elecciones/ballots): `ADMIN`, `ELECTORAL_COMMISSION`.
- Roles que califican en ferias: `JURY`, `ADMIN`, `ELECTORAL_COMMISSION`, `SUPERADMIN`.
- `SUPERADMIN`/superusuario: operaciones privilegiadas (crear admins, `provisionAdmin`, bulk).

Tenant / anti-IDOR: las entidades pertenecen a una org; el middleware `requireElectionInScope` resuelve la org dueña de una elección vía `elections.created_by → users.organization_id` (las elecciones no guardan `organization_id`).

---

## 2. Organizaciones y on-boarding

**Entidades**: `Organization` (tenant) · `OrganizationRequest` (solicitud pública = lead).

**Estados**: `OrganizationRequestStatus` `PENDING → APPROVED | REJECTED`; `Organization.onboardingCompleted` booleano.

**Reglas**:
- Código de org único normalizado a mayúsculas; hex de colores `#RRGGBB`.
- La solicitud nace `PENDING`; `contact_email` único → duplicado 409.
- Aprobar/rechazar **solo ADMIN** y solo si está `PENDING`. El rechazo **exige motivo**; la BD exige `reviewed_by`/`reviewed_at` cuando no es `PENDING`.
- La aprobación usa la función SQL `approve_organization_request` con **bloqueo pesimista `FOR UPDATE`** y genera un código auto-saneado (slug 10 + sufijo) con reintentos anti-colisión.
- Onboarding: `completeOnboarding` no se puede repetir; la BD fuerza `onboarding_completed = (onboarding_completed_at IS NOT NULL)`.

**Flujo**: solicitud pública (`POST /organizations/requests`) → revisión/admin (`PATCH /requests/:id/approve|reject`) → se crea la org → se completa el onboarding (`PATCH /organizations/:id/onboarding` → `POST /.../onboarding/complete`) → la org queda operativa.

**Endpoints** (base `/api/organizations`): `GET /requests`, `POST /requests`, `PATCH /requests/:id/approve|reject`; CRUD `/`, `PATCH|POST /:id/onboarding(/complete)`.

---

## 3. Usuarios y autenticación

**Entidades**: `User` + tokens (`RefreshToken`, `OneTimeToken`, `EmailVerificationToken`, `PasswordResetToken`).

**Estados**: `user_status` `PENDING → ACTIVE | SUSPENDED | DELETED`. Proveedor: `LOCAL | GOOGLE | AWS`. `AvatarType` `DEFAULT_DICEBEAR | UPLOADED | GRAVATAR`.

**Reglas clave**:
- **Registro siempre crea `STUDENT`** (el rol no se acepta del cliente). Estudiante requiere `programId`+ciclo; docente requiere `facultyId`. Correo institucional `.edu`/`.edu.pe`.
- La organización se resuelve automáticamente por **dominio del correo** (`allowed_email_domains`); la carrera/ciclo se derivan del código institucional.
- **Login**: exige `ACTIVE`, sin bloqueo, contraseña válida y `isVerified`. Con 2FA activado devuelve `requiresTotp` con `TOTP_PENDING` (5 min) sin emitir sesión. Anti-enumeración con `DUMMY_HASH` (mismo coste bcrypt).
- **Bloqueo**: 5 intentos fallidos → lock 15 min (SQL `register_failed_login` / `login_is_allowed`).
- **2FA/TOTP**: setup en 2 pasos; `verifyAndEnableTotp` genera 10 backup codes hasheados (uso único); disable exige contraseña.
- **Contraseña**: mín. 8 + mayúscula + minúscula + número; reset solo cuentas `LOCAL` activas, token 1h, rate-limit 5/hora. No se puede volver a usar la misma contraseña.
- **Google OAuth**: solo vincula/inicia sesión si existe cuenta con ese email y está activa.
- **Gestión de usuarios (admin)**: listar es de admin; roles privilegiados (`ADMIN`, `ELECTORAL_COMMISSION`) solo los da un superusuario; nadie cambia su propio rol; se protege el último superuser activo; no puedes desactivarte a ti mismo.
- **Coherencia rol↔datos**: STUDENT exige `programId`; TEACHER exige `facultyId`; roles no académicos limpian programa/ciclo/período.
- **`provisionAdmin`** (solo superuser): crea org + admin con `mustChangePassword` + provisión de QR/OTP 2FA de primer acceso.
- **`createUsersBulk`**: máx 500, valida rol/dominio/duplicados; correo de usuario no-educativo debe estar en los dominios permitidos de la org.

**Flujo**: registro (crea STUDENT + resolución org/carrera) → verificación de email (`PENDING→ACTIVE`) → login → (2FA `POST /auth/totp/login-verify`) → acceso. Recuperación: `forgot` → token 1h → `reset` (revoca refresh tokens). Superadmin: `provision` → `bulk` de jurados/usuarios → gestión.

**Endpoints** (base `/api`): `POST /auth/register|login`, `POST /auth/totp/login-verify`, `POST /auth/password/forgot|reset`, `POST /auth/verify-email|verify-email/resend`, `POST /auth/refresh|logout`, `GET /auth/me`, `POST /auth/totp/setup|verify|disable`, `GET /auth/2fa/status`, `GET /auth/google(/callback)`, `POST /auth/google/verify`; `/users` CRUD + `GET /users/me`, `POST /users/admin/provision|bulk`, `PATCH /users/:id/role|status|unlock`, `POST /users/me/password`.

---

## 4. Académico

**Entidades**: `Faculty` (facultad), `Program` (programa por facultad), `Career` (carrera por org, para derivar datos del código institucional), `AcademicPeriod` (período académico), `VoterRegistry` (padrón electoral), `VoterRegistryClaim` (reclamos del votante sobre el padrón).

**Estados**: `VoterClaimType` `MISSING_FROM_REGISTRY | INCORRECT_DATA | INELIGIBLE_MARKED_ELIGIBLE`; `VoterClaimStatus` `PENDING | APPROVED | REJECTED`. `isEligible` booleano en padrón.

**Reglas**:
- Facultad: nombre/código únicos; no se elimina si tiene programas.
- Período: `start < end`; **sin solape** entre períodos activos (**constraint EXCLUDE con GiST/btree_gist**, además de validación en servicio); **solo un período activo** (`setActivePeriod` transaccional); no se borra con padrón asociado.
- Padrón: un usuario por período (`UNIQUE(user, period)`); motivo obligatorio si es inelegible; **período debe estar activo** para operar (trigger).
- Sync masivo `sync_sis_voters` (solo ADMIN): empareja por `institutional_id` con usuarios `ACTIVE`/`STUDENT`; UPSERT `ON CONFLICT`; **protege inhabilitaciones manuales/reclamos** (no sobrescribe si el motivo no es `ENROLLED_SIS`); actualiza ciclo.
- Elegibilidad para votar: estar en padrón, `is_eligible`, usuario `ACTIVE` y verificado, y período activo (funciones SQL `can_user_vote`).

**Flujo**: Faculty → Programs → Period (uno activo) → sync/carga de padrón → votantes elegibles. Reclamos revisados (APPROVED/REJECTED).

**Endpoints** (base `/api/academic`): CRUD `/faculties`, `/programs`, `/periods` + `PATCH /periods/:id/active` (ADMIN); `/voter-registries` + `POST /voter-registries/sync-sis` (ADMIN) + CRUD (ADMIN/ELECTORAL_COMMISSION).

---

## 5. Elecciones

**Entidad raíz**: `Election` (proceso electoral o evento). Componentes: `Position` (cargo, con `seats`), `CandidateList` (lista o **proyecto**), `Candidacy` (inscripción de usuario), `ElectionRule` (1:1 de configuración), `CandidacyDocument` (documentos con hash SHA-256 — modelo + trigger en BD).

**Enums**:
- `ElectionProcessType`: `VOTE` (clásica), `FAIR` (feria de proyectos), `AWARD` (premiación), `EVENT_POLL` (encuesta de evento), `FEEDBACK`, `FORM` (exige `form_structure` JSON no vacío).
- `ElectionStatusType`: `DRAFT → SCHEDULED → OPEN → CLOSED → CERTIFIED → PUBLISHED` (`PUBLISHED` es terminal). La máquina de estados está doble: servicio (`ALLOWED_TRANSITIONS`) **y trigger SQL**.
- `ElectionScopeType`: `UNIVERSITY` (sin facultad/programa) | `FACULTY` (facultad obligatoria) | `PROGRAM` (facultad+programa obligatorios). CHECK de integridad en BD.
- `CandidacyStatusType`: `PENDING → APPROVED | REJECTED`.

**Reglas clave**:
- **Inmutabilidad por estado**: la elección se edita/borra solo en `DRAFT`. Cargos solo `DRAFT`. Listas, candidaturas y reglas en `DRAFT`/`SCHEDULED`.
- Trigger `enforce_elections_core_lock`: pasados DRAFT/SCHEDULED es imposible cambiar core (scope, período, fechas, título…). Trigger `prevent_election_deletion`: borrado físico solo en DRAFT/SCHEDULED. Trigger `enforce_election_immutability`: bloquea INSERT/UPDATE/DELETE en tablas hijas cuando la elección no es DRAFT/SCHEDULED.
- **Transición a `SCHEDULED`**: exige ≥1 cargo y `endAt` futuro.
- **Certificación** (`CLOSED→CERTIFIED`) se delega en SQL `certify_election(election_id, actor_id)`: autoriza admin/comisión, exige `CLOSED`, corre escrutinio, calcula participación y hace upsert de `election_results`.
- **Publicación** (`CERTIFIED→PUBLISHED`): valida **quórum** antes de pasar de estado.
- Candidatura: usuario debe existir y estar `ACTIVE`; **un usuario no repite en la misma elección**; lista/cargo deben pertenecer a la elección; **un solo candidato principal por cargo y lista** (índice parcial); `status` y `user_id` inmutables en el CRUD actual.
- Reglas de elección: 1:1, quórum 0–100, `max_votes_per_position ≥ 1`.

**Flujo**: crear (`POST /elections`, DRAFT) → cargos → listas/proyectos → candidaturas (PENDING) → reglas → `SCHEDULED` → papeleta (⛳ [§7](#7-papeleta)) → `OPEN` (votar/calificar) → `CLOSED` → `CERTIFIED` → `PUBLISHED`.

**Endpoints** (base `/api/elections`): `GET|POST /` + filtros (status, scope, period, faculty, program, search) y paginación; `GET|PATCH|DELETE /:id`; `PATCH /:id/status`; anidados `/positions`, `/candidate-lists`, `/candidacies`, `/rules`.

---

## 6. Candidaturas

**Listas/proyectos** (`candidate_lists`) — ver [§10](#10-feriasconcursos) para el perfil de proyectos en ferias.
- Nombre y acrónimo únicos por elección; acrónimo vacío → `NULL` (la BD rechaza cadena vacía).
- No se elimina una lista con candidaturas (evita cascada accidental).
- Filtros de búsqueda: `search`, `category`, `status`, `sortBy`, `withRatings`, paginación.

**Candidaturas** (`candidacies`):
- Vinculan un usuario (expositor/candidato) a una lista y cargo, con `orderIndex` y `isPrincipal`.
- La aprobación/`status` tendrá un endpoint dedicado (aún no expuesto); el filtro `status` en listas usa `candidacies.some`.

**Documentos** (`candidacy_documents`): soportan hasta 10 MB, hash SHA-256, URL HTTPS; bloqueados si la elección no es DRAFT/SCHEDULED o la candidatura ya fue resuelta.

---

## 7. Papeleta

**Entidades**: `Ballot` (papeleta **versionada** por elección, una activa), `BallotPosition` (snapshot de un cargo con orden), `BallotOption` (alternativas: `CANDIDATE_LIST | BLANK | VOID`).

**Reglas**:
- **Una boleta activa por elección** (índice parcial único).
- Versionado: `create_ballot_version()` crea `MAX(version)+1` y desactiva la previa (solo DRAFT/SCHEDULED).
- La posición debe pertenecer a la elección de la boleta; sin orden → `count+1`; sin cargos duplicados ni orden duplicado.
- `CANDIDATE_LIST` exige `candidateListId` de la misma elección; `BLANK`/`VOID` **sin** lista, con **un único** por posición; CHECK deriva coherencia tipo↔lista.
- **Completitud**: `validate_ballot_completeness()` ≥ 1 posición y cada posición ≥ 1 opción.
- Inmutabilidad por estado de la elección (trigger).

**Flujo**: crear boleta (v1 activa) → mapear cargos → añadir opciones (listas + BLANK/VOID) → `GET /completeness` para validar → la votación consume la boleta activa.

**Endpoints** (base `/api/ballots`): CRUD `/`, `GET /election/:electionId/active`, `POST /election/:electionId/version`, `GET /:id/completeness`; anidados `/positions`, `/positions/:ballotPositionId/options`.

---

## 8. Votación

El voto es **secreto** (payload cifrado + `payloadHash` SHA-512) y **verificable** por comprobante público. La lógica vive en **funciones SQL `SECURITY DEFINER`**.

**Reglas**:
- Elegible = en padrón, `is_eligible`, usuario `ACTIVE`+verificado, período activo.
- La elección debe estar **`OPEN`** y dentro de `start_at..end_at`.
- **Un voto por elector** (`UNIQUE(election_id, voter_id)`) y **una sesión activa a la vez** (índice parcial); sesiones huérfanas >15 min se limpian.
- El voto solo se inserta si la sesión fue exitosa; trigger valida integridad sesión/elección/votante/ventana temporal.
- Blancos solo si `allow_blank_vote`; límite de selecciones por cargo = `max_votes_per_position`.
- Todas las opciones deben pertenecer a la elección (si el INSERT inserta menos filas → error).
- Token de un solo uso opcional: se consume al iniciar sesión y defensivamente al votar.
- **Anonimato**: el log de `CAST_VOTE` no guarda actor/IP ni datos de identidad.
- Verificación de comprobante devuelve `200 {valid:false}` en vez de 404 (anti-enumeración).

**Flujo**: `POST /voting/elections/:id/sessions` (auth; consume token opcional) → `POST /voting/sessions/:sessionId/cast` (payload + selections; genera `receipt_code` de 64 hex; marca sesión exitosa) → `GET /voting/sessions/:id` (solo dueño) → `GET /public/verify-receipt/:receiptCode` (público; expone solo datos no sensibles).

---

## 9. Resultados

**Entidades**: `Tally` (escrutinio por cargo/opción), `ElectionResult` (acta consolidada con participación, fechas de hito y firma/hash de reporte).

**Reglas**:
- **Recálculo de tallies solo en `CLOSED`**; idempotente: `deleteMany + createMany` atómico en transacción, incluye opciones con 0 votos; BLANK/NULL son opciones normales.
- **Certificar exige `CLOSED`** → recálculo → `certify_election()` (SQL) → `CERTIFIED` → audit solo si tuvo éxito.
- **Publicar exige `CERTIFIED` + quórum** (`turnoutPercentage >= minTurnoutPercentage`; sin reglas, mínimo 0); sin quórum → 409.
- Resultados **LIVE** solo en `CLOSED/CERTIFIED/PUBLISHED`; **FINAL** solo en `PUBLISHED`.
- Participación según `scope_type` contra `voter_registries`.
- Reporte PDF (pdfkit) con hash SHA-256 en header `X-Content-Hash`; export CSV/XLSX con BOM UTF-8, RFC 4180 y **anti formula injection**.

**Flujo**: `POST /elections/:id/tally/recalculate` → `POST /elections/:id/certify` → `POST /elections/:id/publish` → `GET /results/live|final` → descargas (`report.pdf`, `export.csv`, `export.xlsx`).

**Endpoints** (base `/api`): `POST|GET /elections/:id/tally(/recalculate)`, `POST /elections/:id/certify`, `POST /elections/:id/publish`, `GET /results/live|final`, `GET /elections/:id/report.pdf|export.csv|export.xlsx`.

---

## 10. Ferias/concursos

Proyectos, imágenes, comentarios y búsqueda — el flujo completo de feria (FAIR/AWARD/EVENT_POLL).

### 10.1 Cómo se modela un "proyecto en feria"
| Concepto | Modelo |
|---|---|
| Feria / concurso | `Election` (`processType = FAIR \| AWARD \| EVENT_POLL`) |
| Proyecto | `CandidateList` (`name`, `acronym`, `motto`, `logo`, `description`, `image_url`, `category`, `tags`) |
| Expositor responsable | `Candidacy` (`user` + `status` PENDING/APPROVED/REJECTED) |
| Calificación del jurado | `Rating` (1–5 ★ + `comment`, trazable) |
| Imagen subida | `POST /api/upload` → URL guardada en el proyecto |

### 10.2 Columnas nuevas por proyecto (`candidate_lists`)
| Columna | Campo API | Tipo BD | Regla |
|---|---|---|---|
| Descripción | `description` | `TEXT` nullable | Máx 10.000 en API; vacío → `NULL`; CHECK no vacío si tiene valor |
| Imagen | `imageUrl` | `VARCHAR(1000)` nullable | URL de `/api/upload`; vacío → `NULL` |
| Categoría | `category` | `VARCHAR(80)` nullable | Filtro exacto; índice `idx_candidate_lists_category` |
| Etiquetas | `tags` | `JSONB` default `'[]'` | Arreglo, máx 20 tags, cada uno máx 50 |
| Comentario | (derivado) `latestComment` | — | Último comentario de un jurado, expuesto con `withRatings=true` |

### 10.3 Roles y permisos
| Rol | CRUD proyectos | Calificar | Ver resultados |
|---|---|---|---|
| `SUPERADMIN` | ✓ | ✓ | ✓ |
| `ADMIN` / `ELECTORAL_COMMISSION` | ✓ | ✓ | ✓ |
| `JURY` | lectura | ✓ (1–5 ★) | ✓ |
| `TEACHER` / `STUDENT` | ✗ | ✗ | ✓ (viewer) |

### 10.4 Reglas de calificación (`rating.service.js`)
- Solo `FAIR / AWARD / EVENT_POLL` y solo mientras la feria está **`OPEN`**.
- **Un jurado califica UNA vez por proyecto** (`UNIQUE(candidacy_id, juror_id)`, upsert); trazable y revocable (`RatingStatus`).
- Score entero 1–5; comentario opcional ≤ 2000.
- Solo cuentan ratings `ACTIVE` en el promedio.
- Al calificar se notifica al expositor `RATING_RECEIVED` (IN_APP + PUSH, no bloqueante).

### 10.5 Flujo de negocio end-to-end
```
1. ADMIN crea Election(FAIR)                      → DRAFT
2. Registro proyecto: POST candidate-lists        → {name, description, category, imageUrl, tags}
3. Imagen: POST /api/upload → URL → PATCH candidate-lists/{id} {imageUrl}
4. Candidatura del expositor → status APPROVED     → solo proyectos aprobados salen
5. Feria OPEN → jurados califican [POST ratings] (1-5 + comentario)
6. Exploración/búsqueda: GET candidate-lists?<filtros>
7. Resultados: GET ratings/results (promedio + distribución + ranking)
   Feria CLOSED → CERTIFIED → PUBLISHED
```

### 10.6 Búsqueda y filtros (endpoint completo)
`GET /api/elections/:electionId/candidate-lists` — todos opcionales:

| Query | Tipo | Descripción |
|---|---|---|
| `search` | string | Coincidencia parcial (insensible) en **nombre, acrónimo o descripción** |
| `category` | string | Categoría exacta |
| `status` | `PENDING\|APPROVED\|REJECTED` | Estado de la candidatura |
| `sortBy` | `name\|createdAt\|rating` | Orden (`rating` = promedio, luego nº de votos) |
| `limit` / `offset` | int | Paginación (máx 200). **Sin `limit` se devuelve todo** (requisito de la papeleta) |
| `withRatings` | `true\|false` | Adjunta `ratings.count`, `ratings.average`, `latestComment` |

Ejemplo:
```http
GET /api/elections/{id}/candidate-lists?status=APPROVED&category=Tecnología&withRatings=true&sortBy=rating&search=sostenibilidad
```
El orden por `rating` se resuelve en el service (agrega el resumen con `ratingsSummaryByCandidacy` y ordena/pagina en memoria).

### 10.7 Endpoints del módulo
- `POST /api/elections/:id/ratings/:candidacyId` (calificar)
- `GET /api/elections/:id/ratings/results` (promedio por proyecto)
- `GET /api/elections/:id/ratings` (listado trazable, filtro por `candidacyId`, paginado)
- CRUD `/api/elections/:id/candidate-lists` (con filtros de búsqueda)

### 10.8 Migración añadida
- `database/sql/elections/004_candidate_lists.sql` (instalación nueva)
- `database/sql/elections/008_candidate_lists_fair_profile.sql` (idempotente, bases existentes) — registrada en `scripts/apply-sql.js`
- Modelo Prisma `CandidateList` sincronizado; `npm run db:generate` + `npm run db:migrate`.

---

## 11. Auditoría

**Entidad**: `AuditLog` (cadena de hash SHA-256, **inmutable**) · `VotingAccessToken` (token de un solo uso).

**Acciones** (`AuditActionType`): `LOGIN, VERIFY_2FA, CREATE_ELECTION, OPEN_ELECTION, CAST_VOTE, CLOSE_ELECTION, CERTIFY_RESULT, PUBLISH_RESULT`.

**Reglas**:
- La tabla `audit_logs` **rechaza UPDATE/DELETE/TRUNCATE** por triggers; cada fila se encadena por hash (SHA-256 del contenido previo) con función `verify_audit_chain()` y **firma HMAC-SHA256** con secreto.
- `CAST_VOTE` es **anónimo**: `actorId`, `ipAddress` y metadatos de identidad se omiten (CHECKs en BD).
- Tokens de un solo uso: en BD solo `token_hash`; raw de 32 bytes se devuelve **una vez**; **un token activo por (usuario, elección)**; consumo atómico con `FOR UPDATE` (valida pertenencia, expiración y no-uso); estado derivado `ACTIVE | USED | EXPIRED`.
- Rate-limit 30 intentos/15 min para `consume` y `status`.

**Endpoints** (base `/api/audit`): `GET /logs`, `GET /logs/:id`, `POST /logs` (gestores); `POST /tokens`, `POST /tokens/consume`, `GET /tokens/status`, `DELETE /tokens/cleanup`.

---

## 12. Notificaciones

**Entidad**: `Notification` + `NotificationDelivery` por canal. Tipos: `ELECTION_OPENING, VOTE_CONFIRMATION, RESULTS_PUBLISHED, CANDIDACY_APPROVED, SYSTEM_ALERT, FAIR_OPENED, RATING_RECEIVED`. Canales: `IN_APP | EMAIL | PUSH`; estados `PENDING → SENT | FAILED`.

**Reglas**:
- Crear notificaciones: solo `ADMIN/ELECTORAL_COMMISSION`; el resto de operaciones son del dueño.
- **Una entrega por canal por notificación** (unique `notification_id+channel`), creadas en la misma transacción.
- Consistencia: `SENT` exige `sent_at`; `FAILED` exige `error_message`; `PENDING` sin ninguno.
- Reintento automático (+5 min, `attempt_count+1`); worker procesa lotes de 50.
- **Privacidad del voto**: una `VOTE_CONFIRMATION` no puede incluir selecciones/candidatos en metadata (CHECK).

**Endpoints** (base `/api/notifications`): `GET /unread-count`, `GET /`, `POST /` (admin/comisión), `PATCH /mark-all-read`, `PATCH /:id`.

---

## 13. Upload

**Entidad**: `media_files` (registro de subida por usuario).

**Reglas**: autenticación requerida; whitelist MIME (`image/jpeg|png|webp`, `application/pdf`); **máx 5 MB** y **3 archivos** por petición; nombre seguro `file-<uuid><ext>` (anti path-traversal); se devuelve la URL pública `APP_URL/uploads/...`.

**Endpoints**: `POST /api/upload` (multipart, campo `file`) → `{url, mimetype, size}`.

---

## 14. i18n

**Entidad**: `PlatformTranslation` — diccionario de traducciones con `values` JSONB por locale y clave única.

**Reglas**: lectura pública (`GET /dictionary`); CRUD solo ADMIN; resolución con **fallback encadenado** en SQL (locale → idioma base → `es-PE` → `es` → clave); locale efectivo = preferencia del usuario → `default_locale` de la org → `'es-PE'`. Clave con regex `^[a-z0-9._-]+$`, ≤150.

**Endpoints** (base `/api/platform/translations`): `GET /dictionary`, `GET /effective-locale/:userId`, CRUD `/`.

---

## 15. Reglas transversales

- **Multi-tenant / anti-IDOR**: scopes resueltos por la org del creador (`scope.middleware.js`); aplicado en ratings, results, audit de elección, etc.
- **Inmutabilidad de elecciones**: máquina de estados replicada en servicio **y** triggers SQL; tablas hijas bloqueadas fuera de DRAFT/SCHEDULED.
- **Auditoría**: registros encadenados por hash + firmados con HMAC + inmutabilidad SQL + anonimato del voto.
- **Seguridad de autenticación**: bcrypt, bloqueo por intentos, anti-enumeración, tokens con hash y expiración, rate-limiting en endpoints sensibles (`consumo de tokens`, `password reset`, `login`).
- **Anonimato del voto y del comprobante**: no se enumeran receipt codes; los logs de voto no llevan identidad; las notificaciones de voto no filtran selecciones.
- **Idempotencia**: tallies, upserts de ratings, versionado de papeletas.

---

# PARTE II — PLAN DE ADAPTACIÓN AL CONTEXTO PERUANO

Plan consolidado aprobado para adecuar CampusVote a la Ley Universitaria peruana (elecciones ponderadas, tachas, identidad DNI/CE) y a estándares de ferias de investigación (CONCYTEC/SUNEDU/OECD).

## 16. Decisiones de negocio tomadas

| Decisión | Elección | Detalle |
|---|---|---|
| Escala de rúbricas | **Vigesimal 20** | Nota final 0–20; `maxScore` uniforme 20 por criterio |
| Quórum estamental fallido | **Configurable por elección** | En `ElectionRule`: nulidad global / solo estamento / segunda vuelta |
| Validación RENIEC/PIDE | **Interfaz + mock ahora** | `IdentityProvider` con mock para dev; proveedor real se conecta después |
| 2FA SMS/WhatsApp | **Interfaz + mock ahora** | `MessagingProvider` listo para conectar gateways (Twilio/local) |
| DNI/CE obligatorio | **Solo docentes y mesa electoral** | `JURY`, `ELECTORAL_COMMISSION`, `ADMIN`; estudiantes opcional |
| Doble ciego + conflicto de interés | **Obligatorio en toda feria** | Proyección anónima para jurados + declaración jurada al asignar |
| Sub-ponderación docente (P/A/A) | **Fase futura** | Se documenta como extensión; ahora solo 2/3 docentes – 1/3 estudiantes |

## 17. Hallazgos en el código real

- `database/sql/challenges/001_candidacy_challenges.sql` está **mal nombrado**: no contiene tachas, es un duplicado de `sync_sis_voters` (ver `academic/008_sis_sync.sql`). **No existe ninguna entidad de impugnación** en BD ni módulo Node (`src/modules` no tiene `challenges/`). Debe renombrarse/eliminarse para evitar confusión.
- `claims/001_voter_registry_claims.sql` sí es funcional (reclamos de padrón + `resolve_voter_registry_claim` SECURITY DEFINER con `FOR UPDATE`).
- `certify_election()` y `tally_election_votes()` son funciones cerradas; el voto ponderado será una **función hermana**, no un parche dentro.
- `ElectionRule` ya es `1:1` con `Election` → los nuevos flags/coeficientes caben sin cambiar relaciones.
- Existen migraciones SQL opcionales `reports/` y `public/` sin módulos Node aún.

## 18. Fase 0 — Fundaciones transversales

- **Migraciones**: nuevos archivos en `database/sql/<módulo>/*.sql` + registro en `scripts/apply-sql.js` y `tests/setup-db.js`. Patrón idempotente (`DO $$ CREATE TYPE ... EXCEPTION`, `ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`).
- **Enums nuevos** (SQL + Prisma): `document_type` (DNI/CE), `stake` (estamento congelado), `objection_type/status`, `jury_assignment_status`, canal `SMS`, nuevos `AuditActionType` (CARECEN de tachas/asignaciones).
- **Proveedores externos** en `src/shared/providers/`: `IdentityProvider` (verificar DNI: interfaz + mock) y `MessagingProvider` (enviar SMS/WhatsApp: interfaz + mock), inyectados vía config para no acoplarse en dev.

## 19. Fase 1 — Identidad peruana (DNI/CE)

- `User`: `document_type` (enum DNI/CE) + `document_number VARCHAR(20)`, índice **único parcial** `(organization_id, document_number) WHERE document_number IS NOT NULL`.
- CHECKs: DNI = 8 dígitos; CE = 9–12 alfanumérico. Requerido para `JURY`/`ELECTORAL_COMMISSION`/`ADMIN` y docentes; opcional para estudiantes.
- Verificación vía `IdentityProvider` en: registro, actualización de perfil, `provisionAdmin`, `createUsersBulk` y sync SIS.
- `VoterRegistry`: nueva columna `stake` (estamento **congelado** al momento de la inscripción en padrón, no el rol actual) — **prerrequisito** de la Fase 2.

## 20. Fase 2 — Voto ponderado y quórum diferenciado

- `ElectionRule`: `is_weighted`, `teacher_weight`, `student_weight` (DECIMAL(5,2), ej. 0.67/0.33), `min_teacher_turnout`, `min_student_turnout`.
- Nueva función SQL `compute_weighted_tallies()`: agrupa votos por `stake` del padrón **congelado**; persiste **votos crudos y ponderados** (transparencia). `certify_weighted_election()` solo para elecciones `is_weighted`; las elecciones estándar conservan `certify_election` intacto.
- Quórum evaluado **por estamento** en la transición CERTIFIED→PUBLISHED según la regla configurada (ver §16). Consecuencias de estamento corto: nulidad global / solo ese estamento / segunda vuelta.
- Sub-ponderación interna docente (Principales/Asociados/Auxiliares): **documentada pero no implementada** en esta ronda.

## 21. Fase 3 — Tachas e impugnaciones electorales

- Nueva entidad `CandidacyObjection`: blanco (lista `candidateListId` o candidato `candidacyId`), tipo (`TACHA_LIST`, `TACHA_CANDIDATE`, `IMPUGNACION_VOTE`, `IMPUGNACION_RESULT`), motivo, evidencias (`media_files`), `filedBy`, estados `PENDING → FOUNDED | UNFOUNDED | WITHDRAWN`, `resolvedBy/resolvedAt/resolutionNotes`.
- **Una tacha PENDING por blanco** (índice único parcial).
- Ventana: fase `SCHEDULED`. El tránsito a `OPEN` exige **0 tachas pendientes** (nueva precondición de la máquina de estados). Si FOUNDED → se desactiva al blanco y se **regenera la papeleta** (`create_ballot_version`).
- Resolución por `ADMIN`/`ELECTORAL_COMMISSION` con patron de `resolve_voter_registry_claim` (SECURITY DEFINER, `FOR UPDATE`, autorización) + auditoría obligatoria en `audit_logs`.
- Endpoints: `GET/POST /api/elections/:id/objections`, `PATCH /api/elections/:id/objections/:id/resolve`. Documentos usando el módulo de upload (límites ver §29 item 5).
- Limpieza: renombrar/eliminar `database/sql/challenges/001_candidacy_challenges.sql` (ver §17).

## 22. Fase 4 — Rúbricas multicriterio (spec técnica)

### 22.1 Schema Prisma (adaptado a convenciones del repo: ESM/Prisma `gen_random_uuid()`, `@map` snake_case)

**`rating.prisma`**:

```prisma
model FeriaCriterion {
  id            String          @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  electionId    String          @map("election_id") @db.Uuid
  name          String          @db.VarChar(120)        // "Metodología", "Innovación"...
  weight        Decimal         @db.Decimal(5, 2)       // 0.30 (30%)
  maxScore      Int             @default(20) @map("max_score") @db.SmallInt   // vigesimal

  election      Election        @relation(fields: [electionId], references: [id], onDelete: Cascade)
  ratingDetails RatingDetail[]

  @@unique([electionId, name], map: "uq_feria_criteria_election_name")
  @@index([electionId], map: "idx_feria_criteria_election")
  @@map("feria_criteria")
}

model RatingDetail {
  id          String          @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  ratingId    String          @map("rating_id") @db.Uuid
  criterionId String          @map("criterion_id") @db.Uuid
  score       Decimal         @db.Decimal(5, 2)         // nota parcial por criterio

  rating      Rating          @relation(fields: [ratingId], references: [id], onDelete: Cascade)
  criterion   FeriaCriterion  @relation(fields: [criterionId], references: [id], onDelete: Restrict)

  @@unique([ratingId, criterionId], map: "uq_rating_details_rating_criterion")
  @@index([criterionId], map: "idx_rating_details_criterion")
  @@map("rating_details")
}
```

**`Rating`** — SE MANTIENE `electionId` (scope/índices/resultados) y `score` pasa a `Decimal(5,2)`:

```prisma
model Rating {
  id          String       @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  electionId  String       @map("election_id") @db.Uuid
  candidacyId String       @map("candidacy_id") @db.Uuid
  jurorId     String       @map("juror_id") @db.Uuid
  score       Decimal      @db.Decimal(5, 2)       // SMALLINT → DECIMAL(5,2): puntaje ponderado final
  comment     String?      @db.Text
  status      RatingStatus @default(ACTIVE)
  createdAt   DateTime     @default(now()) @map("created_at") @db.Timestamptz
  updatedAt   DateTime     @default(now()) @updatedAt @map("updated_at") @db.Timestamptz
  ratingDetails RatingDetail[]

  @@unique([candidacyId, jurorId], name: "uq_ratings_candidacy_juror")
  @@index([electionId], map: "idx_ratings_election")
  @@map("ratings")
}
```

Relación inversa añadida en `Election`: `criteria FeriaCriterion[]`.

> **Retrocompat**: `ratingsSummaryByCandidacy`, `sortBy=rating`, resultados y `withRatings` trabajan sobre `Rating.score` → al ser ahora Decimal siguen funcionando sin cambios de API.

### 22.2 Migración

Nuevo `database/sql/ratings/002_feria_rubrics.sql` (idempotente) registrado **después de** `ratings/001_ratings.sql`:
- `CREATE TABLE feria_criteria` + `rating_details` (+ FK, índices únicos).
- `ALTER TABLE ratings ALTER COLUMN score TYPE numeric(5,2) USING score::numeric` (migra 1–5 → 1.00–5.00).
- CHECKs: `weight > 0`, `max_score BETWEEN 1 AND 20`, `score` de detalle ≥ 0 (rango fina en service).

### 22.3 Servicio (`rating.service.js` — algoritmo aprobado)

`submitFeriaRating(electionId, candidacyId, jurorId, { ratings, comment })`:
1. Elección existe, es `FAIR/AWARD/EVENT_POLL`, está `OPEN` y dentro de `startAt..endAt`.
2. Candidatura existe, `APPROVED` y pertenece a la elección (anti-IDOR).
3. Rúbrica completa: `ratings.length === election.criteria.length`; cada `criterionId` pertenece a la elección; `0 ≤ score ≤ maxScore`.
4. Hook de Fase 5: `JuryAssignment` activo + `conflictDeclaration` firmado → si no, `403 JURY_NOT_ASSIGNED`.
5. Puntaje calculado = `Σ (score * weight)`; **el score final nunca viene del cliente**.
6. `$transaction`: upsert `Rating` (misma clave `candidacyId_jurorId`), `deleteMany` + `createMany` de `RatingDetail`, re-lectura con `include: { ratingDetails: true }`.
7. **No auto-resucitar `REVOKED`**: un re-voto no reactiva una nota revocada salvo autorización de ADMIN.
8. La validación `Σ weights = 1.00` se hace al **crear/editar criterios** (endpoint de admins), no en cada calificación; notificación `RATING_RECEIVED` al expositor.

### 22.4 Integración con el resto del plan
- **Fase 5**: el rating exige asignación → 403 en servicio (o trigger SQL).
- **Fases 2/6**: `finalize_fair_results()` consume `Rating.score` (Decimal) para la media del jurado y la mezcla 80/20 con el popular.
- **Fase 7**: `tieBreakerCriterionId` apunta a `FeriaCriterion.id`; la comparación usa el `RatingDetail.score` crudo.
- **Fase 3**: la matriz por criterio queda trazable (`RatingDetail`) para responder tachas.
- **Inmutabilidad**: criterios bloqueados desde `OPEN` (trigger, mismo patrón que positions/ballots).

## 23. Fase 5 — Asignación de jurados, conflicto de interés y doble ciego

- `JuryAssignment` (`electionId`, `candidacyId/candidateListId`, `juryId`, estado `PENDING→APPROVED/REJECTED`, `isDiriment` bool, `conflictDeclaration` bool + `declaredAt`, `assignedBy`).
- **Solo jurados con asignación activa califican** (integra con §22.3). El `UNIQUE(candidacyId, jurorId)` de `Rating` se mantiene.
- Conflictos: cruce `juror.program.facultyId` ↔ expositor (`candidacy.user.programId → Program.facultyId`) + **`advisorId` nuevo en `Candidacy`** (detecta asesor principal). Si hay conflicto → se bloquea la asignación o se exige declaración (ambas se registran).
- Doble ciego **obligatorio**: proyección anonimizada (id, título, categoría, sin expositores) para la vista del jurado. La declaración jurada es precondición para calificar.
- Asignación, declaración y resolución quedan en `audit_logs`.

## 24. Fase 6 — Voto popular 80/20 (People's Choice)

- **Reutiliza el motor electoral inmutable**: un `Position` (ej. "Premio del Público") con `BallotOption` solo `CANDIDATE_LIST` de proyectos `APPROVED` + `Vote/VoteSelection` (secreto, unicidad, auditoría gratis).
- Elegibilidad: padrón (`voter_registries`) para `STUDENT`/`TEACHER`; la feria sigue su `scope_type`.
- `ElectionRule`: `juryWeight` + `publicWeight` (suman 100). `finalize_fair_results()` normaliza el popular (porcentaje del total emitido, no votos crudos) y combina: `notaFinal = juryWeight·notaJurado + publicWeight·notaPopular`.
- El acta reporta la desagregación (jurado / público / final).

## 25. Fase 7 — Reglas de desempate

- `ElectionRule.tieBreakerCriterionId` → `FeriaCriterion.id`. Orden de ranking: promedio ponderado → criterio desempate (mayor `RatingDetail.score`) → siguiente criterio → nº de ratings ACTIVE → timestamp más temprano.
- **Voto dirimente**: flag `isDiriment` en `JuryAssignment` (sin rol global nuevo). El dirimente se registra como resolución en `election_results` (`tieBreakApplied`, `tieBreakWinnerId`, `tieBreakAt`), **nunca** se mezcla con conteos.

## 26. Fase 8 — Catálogo de categorías OCDE/CONCYTEC

- Categorías controladas (6 áreas OCDE: Ciencias Naturales; Ingeniería y Tecnología; Ciencias Médicas y de la Salud; Ciencias Agrícolas; Ciencias Sociales; Humanidades) + catálogo extensible por org (`Organization.category_catalog JSONB`).
- Validación del campo `category` en `candidateList.schema.js` (create/update) contra el catálogo efectivo; opcional CHECK en BD.
- Normalización de data existente (script de datos) y documentación para SINEACE/SUNEDU.

## 27. Fase 9 — 2FA por SMS/WhatsApp (baja prioridad)

- `MessagingProvider` (interfaz + mock) en `src/shared/providers/`.
- Canal `SMS` nuevo en `DeliveryChannel`; OTP por `OneTimeToken` existente (hash en BD, expiración, consumo atómico).
- Login OTP: fallback TOTP → SMS cuando el 2FA esté configurado; `requires2fa` ya existe en `ElectionRule`.
- No toca la legitimidad del resultado: prioridad baja.

## 28. Orden de trabajo

| Fase | Alcance | Riesgo/Esfuerzo |
|---|---|---|
| F0 | Fundaciones, enums, proveedores, limpieza `challenges/` | Bajo |
| F1 | DNI/CE + `stake` en padrón | Bajo |
| F2 | Voto ponderado + quórum diferenciado (SQL) | Alto |
| F3 | Tachas e impugnaciones (entidad + flujo + papeleta) | Alto |
| F4 | Rúbricas multicriterio (spec §22) | Alto |
| F5 | JuryAssignment + conflicto + doble ciego | Alto |
| F6 | Voto popular 80/20 (reuso motor electoral) | Alto |
| F7 | Desempates (criterio + dirimente) | Medio |
| F8 | Catálogo OCDE/CONCYTEC | Bajo |
| F9 | 2FA SMS/WhatsApp | Medio |

Dependencias: F1 → F2 (necesita `stake`); F4 hook de F5; F6/F7 usan F4; F3 regenera papeletas (reusa ballots).
Tests: unidad + integración SQL; requieren Postgres (`tests/setup-db.js` necesita DB en `.env.test`).

## 29. Chequeo de planteamientos adicionales

Evaluación de la retroalimentación recibida (estado real, contradicciones y decisión):

| # | Planteamiento | Estado real | Decisión |
|---|---|---|---|
| 1 | Rate-limiting personalizado **por usuario+elección** | Parcial: hoy hay rate-limit en endpoints sensibles | **Mejora transversal**: clave compuesta `userId+electionId` en votación/calificación/tachas (F0) |
| 2 | Anti-IDOR amplio + **registrar intentos no autorizados** | Parcial: existe `scope.middleware.js` | Ampliar cobertura a todos los entry points; auditar rechazos de triggers de inmutabilidad (transversal) |
| 3 | Calificaciones **múltiples** (solo la más reciente cuenta) | **Ya alineado**: upsert `UNIQUE(candidacyId,jurorId)` + re-creación de `RatingDetail` → la última gana | Confirmado; REVOKED no se resucita sin autorización (§22.3) |
| 4 | Notificación de voto **sin detalle** + resumen visual de resultados | Parcial: `VOTE_CONFIRMATION` ya existe y NO guarda selecciones (CHECK en BD) | **Mejora**: `RESULTS_PUBLISHED` con resumen (ganador/top) en `metadata` (F4/F6) |
| 5 | Upload: **10 MB / 10 archivos** ("sin sobrepasar 5 MB" — **contradictorio**) | Hoy: 5 MB / 3 por petición; `CandidacyDocument` ya soporta 10 MB (1 por tipo) | **Decisión: límites por propósito** — upload genérico 5 MB/3; evidencias de tacha (F3) hasta 10 MB/10 archivos; confirmar al implementar F3 |
| 6 | i18n fallback encadenado + validación estricta de claves | **Ya implementado** (fallback locale→es-PE→es; regex `^[a-z0-9._-]+$`, ≤150) | Sin cambios |
| 7 | Bcrypt sal única + anti-enumeración | **Ya implementado** (sal por hash bcrypt; `DUMMY_HASH` en login) | Sin cambios; revisar cost factor bajo rollout |
| 8 | Idempotencia tallies/upserts + versionado de papeletas | **Ya implementado** (recount atómico; `create_ballot_version`, una activa) | Sin cambios |
| 9 | Calificación en tiempo real, solo la más reciente | **Ya alineado** (ventana OPEN + upsert) | Confirmado (§22.3) |
| 10 | Filtros avanzados (fecha, rango de rating) + paginación optimizada | Parcial: hay `search/category/status/sortBy/limit/offset` | **Mejora**: añadir rango de rating y ventana de fechas a `candidate-lists`; evaluar cursor-based para volúmenes grandes (F4/F8) |

Definiciones finales de detalle (como `tieBreakApplied`, rango de rating en filtros y contenido del resumen de resultados) se fijan en la implementación de cada fase.

---

## 30. Estado de implementación (build F0–F9)

Estado real al finalizar el primer ciclo de build. Verificación aplicada: `npm run db:generate` OK, `eslint` OK (solo warnings pre-existentes de TODOs), `node --check` OK en todos los archivos tocados. **Pendiente por banco:** validar las funciones SQL con Postgres (no hay instancia local) y correr `tests/setup-db.js` + suite de integración.

### Schema Prisma (validado con `prisma generate`)
- `user.prisma`: `DocumentType` (DNI/CE), `User.document_type`/`document_number` (VARCHAR 20), índice por `document_number`, UNIQUE parcial `(organization_id, document_number)`; relaciones de asesoría, jurados y objeciones.
- `academic.prisma`: `StakeType` + `VoterRegistry.stake` (estamento CONGELADO en padrón).
- `election.prisma`: `QuorumFailPolicy`; `ElectionRule` con `is_weighted`, pesos docentes/estudiantes, quórum mínimo por estamento, `jury_weight`/`public_weight`, `tie_breaker_criterion_id`; `Candidacy.advisor_id`.
- `rating.prisma`: `Rating.score` → `Decimal(5,2)`; `FeriaCriterion` (nombre, peso, `max_score`=20) y `RatingDetail` (matriz nota×criterio).
- `jury.prisma` (nuevo): `JuryAssignment` con `is_diriment`, `conflict_declaration`, `declared_at`, `assigned_by`.
- `objections.prisma` (nuevo): `CandidacyObjection` con `objection_type` (TACHAs/IMPUGNACIONes), evidencias, filer y reviewer.
- `voting.prisma`: `Tally.stake` (desglose por estamento) y `ElectionResult` con `weighted_config`, `fair_ranking`, `tie_break_applied/winner/at`.
- `organization.prisma`: `category_catalog` JSONB; `notification.prisma`: canal `SMS`; `user` + `phone_number`; `audit.prisma`: 4 acciones nuevas (FILE_OBJECTION, RESOLVE_OBJECTION, ASSIGN_JURY, SUBMIT_RATING).

### Migraciones SQL nuevas (idempotentes, registradas en `apply-sql.js` + `setup-db.js`)
| Archivo | Contenido |
|---|---|
| `user/011_document_identity.sql` | enums/columnas DNI-CE + checks de formato + UNIQUE parcial |
| `academic/010_voter_stake.sql` | `stake` en padrón + backfill TEACHER |
| `elections/009_election_rules_peru.sql` | reglas ponderadas + quórum + `tie_breaker_criterion_id` |
| `elections/010_candidacy_advisor.sql` | `candidacies.advisor_id` |
| `ratings/002_feria_rubrics.sql` | `feria_criteria` + `rating_details` + `score` NUMERIC(5,2) + FK tie-break + trigger inmutabilidad |
| `ratings/003_jury_assignments.sql` | tabla + inmutabilidad (DRAFT/SCHEDULED) |
| `objections/001_candidacy_objections.sql` | tabla + UNIQUE 1-PENDING por objetivo + trigger de ventana/estados |
| `organizations/005_category_catalog.sql` | `category_catalog` |
| `notifications/002_channels.sql` | canal SMS + `users.phone_number` |
| `audit/007_actions_peru.sql` | 4 acciones nuevas |
| `results/006_weighted_fair.sql` | `tallies.stake` + `certify_weighted_election` + `compute_weighted_tallies` + `finalize_fair_results` (ranking + marcador de desempate) |
- Limpieza: `challenges/001_candidacy_challenges.sql` (duplicado de `sync_sis_voters`) retirado del registro.

### Código (módulos)
- **F0** — `src/shared/providers/` (`identityProvider.js` con checksum DNI Reniec + `messagingProvider.js` mock SMS).
- **F1** — DNI/CE obligatorio (service) para `JURY`/`ELECTORAL_COMMISSION`/`ADMIN`/`TEACHER`; verificación contra `IdentityProvider`; campos expuestos en `formatUserResponse`; soporte en `createUser`/bulk/`updateUser`/`updateMe`.
- **F4** — `createCriterion` valida Σ pesos = 1.00 y ventana DRAFT/SCHEDULED; `rateProject` exige `details` completo, calcula `score = Σ(nota×peso)` (nunca del cliente) y persiste `RatingDetail`; resultados con promedio ponderado.
- **F5** — `juryAssignment.*`: asignar (PENDING), aprobar/rechazar (APPROVED/REJECTED), firmar declaración (`declared: true` → `conflict_declaration`), listar con doble ciego (jurado ve solo su panel; nombre de jurado solo a ADMIN/COMISIÓN). `rateProject` exige asignación APPROVED + declaración; se bloquean conflictos (asesor del proyecto, mismo autor, misma facultad).
- **F3** — módulo `objections.*` (filar tacha/impugnación, resolver FOUNDED/UNFOUNDED/WITHDRAWN, listar); `election.service.changeStatus` NO abre en OPEN con tachas pendientes; tacha FUNDADA desactiva la candidatura (REJECTED). Regeneración completa de papeletas: pendiente (documentada).
- **F2/F6/F7** — endpoint `POST /elections/:id/certify-weighted` (quórum por estamento + pesos desde `election_rules` o body) y `POST /elections/:id/finalize-fair` (ranking 80% rúbricas / 20% popular + tie-break registrado en `election_results`).
- **F8** — `src/constants/categories.js` (6 áreas OCDE) + validación de `category` contra catálogo de la organización (o OCDE por defecto) en create/update de candidate-lists.
- **F9** — interfaz/mock de `MessagingProvider` + canal SMS + `users.phone_number`. El envío real de OTP por SMS queda pendiente de wiring (prioridad baja).

### Pendientes de grosor (siguiente ciclo)
- Postgres local para validar las 11 migraciones nuevas y la suite de integración.
- Auditoría: `AUDIT_ACTIONS` ampliado en `audit.schema.js`; ya se llaman `FILE_OBJECTION`, `RESOLVE_OBJECTION`, `ASSIGN_JURY`, `SUBMIT_RATING` (log no bloqueante). Cubrir `certify-weighted`/`finalize-fair`.
- F3: regenerar papeleta al resolver tacha FUNDADA en los casos que afectan la oferta de candidatos.
- F9: enviar OTP por SMS en el flujo de 2FA.
- Rate-limiting específico por `userId+electionId` en votación/calificación/tachas (§29.1).