/**
 * @file fairEvaluation.docs.js
 * @description Documentación OpenAPI (Swagger) del módulo de rúbricas y
 *   evaluaciones de proyectos de ferias académicas (dominio exclusivo de FERIAS;
 *   NO mezcla con ratings electorales).
 * @openapi
 * components:
 *   schemas:
 *     FairRubric:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         fair_id:
 *           type: string
 *           format: uuid
 *         name:
 *           type: string
 *         description:
 *           type: string
 *           nullable: true
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 *         criteria:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/RubricCriterion'
 *     RubricCriterion:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         name:
 *           type: string
 *         description:
 *           type: string
 *           nullable: true
 *         min_score:
 *           type: number
 *           format: float
 *         max_score:
 *           type: number
 *           format: float
 *         position:
 *           type: integer
 *     FairEvaluation:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         fair_id:
 *           type: string
 *           format: uuid
 *         project_id:
 *           type: string
 *           format: uuid
 *         project:
 *           type: object
 *         jury:
 *           type: object
 *         total_score:
 *           type: number
 *         comment:
 *           type: string
 *           nullable: true
 *         details:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               criterion_id:
 *                 type: string
 *                 format: uuid
 *               criterion_name:
 *                 type: string
 *               min_score:
 *                 type: number
 *               max_score:
 *                 type: number
 *               score:
 *                 type: number
 *     FairJuryDeclaration:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         fair_id:
 *           type: string
 *           format: uuid
 *         signed_at:
 *           type: string
 *           format: date-time
 *         statement:
 *           type: string
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 *     FairJuryProgress:
 *       type: object
 *       properties:
 *         fair_id:
 *           type: string
 *           format: uuid
 *         fair_name:
 *           type: string
 *         fair_status:
 *           type: string
 *           enum: [DRAFT, OPEN, CLOSED]
 *         declaration:
 *           allOf:
 *             - $ref: '#/components/schemas/FairJuryDeclaration'
 *           nullable: true
 *         total_projects:
 *           type: integer
 *         evaluated_projects:
 *           type: integer
 *         remaining:
 *           type: integer
 *         progress_percentage:
 *           type: integer
 *           description: Porcentaje de avance redondeado (0-100)
 *         evaluations:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/FairEvaluation'
 */

/**
 * @openapi
 * /api/fairs/{id}/rubric:
 *   get:
 *     tags: [Fair Evaluations]
 *     summary: Obtener la rúbrica de una feria (ADMIN/SUPERADMIN o JURY asignado)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/FairId'
 *     responses:
 *       200:
 *         description: Rúbrica de la feria con sus criterios ordenados
 *       404:
 *         description: La feria aún no tiene una rúbrica configurada
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedResponse'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenResponse'
 *   post:
 *     tags: [Fair Evaluations]
 *     summary: Crear la rúbrica de una feria (ADMIN, solo en DRAFT)
 *     description: >
 *       Una sola rúbrica activa por feria (sin versionado). Solo se configura
 *       en estado DRAFT; se congela al abrir la feria (OPEN) para que todos los
 *       jurados evalúen bajo las mismas reglas.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/FairId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string, minLength: 1, maxLength: 200 }
 *               description:
 *                 type: string
 *                 maxLength: 5000
 *                 nullable: true
 *     responses:
 *       201:
 *         description: Rúbrica creada
 *       409:
 *         description: La feria ya tiene una rúbrica o no está en DRAFT
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedResponse'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenResponse'
 *   put:
 *     tags: [Fair Evaluations]
 *     summary: Actualizar la rúbrica de una feria (ADMIN, solo en DRAFT)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/FairId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string, maxLength: 200 }
 *               description:
 *                 type: string
 *                 maxLength: 5000
 *                 nullable: true
 *     responses:
 *       200:
 *         description: Rúbrica actualizada
 *       409:
 *         description: La feria no está en DRAFT
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedResponse'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenResponse'
 *
 * /api/fairs/{id}/rubric/criteria:
 *   post:
 *     tags: [Fair Evaluations]
 *     summary: Agregar un criterio a la rúbrica (ADMIN, solo en DRAFT)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/FairId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, min_score, max_score]
 *             properties:
 *               name: { type: string, minLength: 1, maxLength: 200 }
 *               description:
 *                 type: string
 *                 maxLength: 5000
 *                 nullable: true
 *               min_score: { type: number }
 *               max_score: { type: number }
 *               position:
 *                 type: integer
 *                 minimum: 1
 *                 description: Orden del criterio (por defecto se anexa al final)
 *     responses:
 *       201:
 *         description: Criterio agregado
 *       409:
 *         description: Posición en uso o feria no configurable
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedResponse'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenResponse'
 *
 * /api/fairs/{id}/rubric/criteria/{criterionId}:
 *   put:
 *     tags: [Fair Evaluations]
 *     summary: Actualizar un criterio (ADMIN, solo en DRAFT)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/FairId'
 *       - in: path
 *         name: criterionId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string, maxLength: 200 }
 *               description:
 *                 type: string
 *                 maxLength: 5000
 *                 nullable: true
 *               min_score: { type: number }
 *               max_score: { type: number }
 *               position: { type: integer, minimum: 1 }
 *     responses:
 *       200:
 *         description: Criterio actualizado
 *       409:
 *         description: Posición en uso o feria no configurable
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedResponse'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenResponse'
 *   delete:
 *     tags: [Fair Evaluations]
 *     summary: Eliminar un criterio (ADMIN, solo en DRAFT)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/FairId'
 *       - in: path
 *         name: criterionId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Criterio eliminado
 *       409:
 *         description: La feria no está en DRAFT
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedResponse'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenResponse'
 *
 * /api/fairs/{id}/projects:
 *   get:
 *     tags: [Fair Evaluations]
 *     summary: Listar proyectos evaluables (APPROVED) de una feria
 *     description: >
 *       ADMIN/SUPERADMIN ve los proyectos de su feria; JURY SOLO si está
 *       formalmente asignado a esa feria.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/FairId'
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
 *     responses:
 *       200:
 *         description: Lista paginada de proyectos aprobados
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedResponse'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenResponse'
 *
 * /api/fairs/{id}/projects/{projectId}:
 *   get:
 *     tags: [Fair Evaluations]
 *     summary: Detalle de un proyecto para revisión del JURY asignado
 *     description: >
 *       Endpoint EXCLUSIVO del JURY (ADMIN/SUPERADMIN no obtienen acceso aquí).
 *       El jurado debe estar formalmente asignado a la feria y el proyecto debe
 *       ser APPROVED y pertenecer a ESA feria (si no, 404 para no revelar
 *       proyectos de otras ferias). Consulta DERIVADA de Project/ProjectMember:
 *       devuelve información ya existente (nombre, descripción, logo_url,
 *       cover_url, project_url, integrantes); NO persiste ProjectReview ni
 *       puntuaciones. Se devuelven solo datos seguros (sin email/documento).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/FairId'
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Detalle del proyecto (información existente + integrantes)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 project_id: { type: string, format: uuid }
 *                 fair_id: { type: string, format: uuid }
 *                 name: { type: string }
 *                 description: { type: string, nullable: true }
 *                 logo_url: { type: string, nullable: true }
 *                 cover_url: { type: string, nullable: true }
 *                 project_url: { type: string, nullable: true }
 *                 status: { type: string, enum: [DRAFT, SUBMITTED, APPROVED, REJECTED] }
 *                 members:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string, format: uuid }
 *                       first_name: { type: string }
 *                       last_name: { type: string }
 *                       role: { type: string }
 *       404:
 *         description: Proyecto no pertenece a la feria o no está APPROVED
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedResponse'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenResponse'
 *
 * /api/fairs/{id}/evaluations:
 *   get:
 *     tags: [Fair Evaluations]
 *     summary: Listar evaluaciones de una feria
 *     description: >
 *       ADMIN/SUPERADMIN ve todas las evaluaciones (+ filtros por project_id y
 *       jury_user_id). JURY ve SOLO las suyas mientras esté asignado.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/FairId'
 *       - in: query
 *         name: project_id
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: jury_user_id
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
 *     responses:
 *       200:
 *         description: Lista paginada de evaluaciones
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedResponse'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenResponse'
 *   post:
 *     tags: [Fair Evaluations]
 *     summary: Registrar la evaluación de un proyecto (JURY asignado)
 *     description: >
 *       La evaluación pertenece a la TRIADA (feria, proyecto, jurado): un
 *       jurado solo evalúa proyectos APPROVED de la MISMA feria mientras está
 *       formalmente asignado y la feria está OPEN. La rúbrica la resuelve el
 *       backend; los scores se validan contra [min_score, max_score] de cada
 *       criterio y debe calificarse la rúbrica COMPLETA.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/FairId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [project_id, scores]
 *             properties:
 *               project_id: { type: string, format: uuid }
 *               comment:
 *                 type: string
 *                 maxLength: 5000
 *                 nullable: true
 *               scores:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required: [criterion_id, score]
 *                   properties:
 *                     criterion_id: { type: string, format: uuid }
 *                     score: { type: number }
 *     responses:
 *       201:
 *         description: Evaluación registrada
 *       409:
 *         description: Ya existe evaluación para ese proyecto, feria no OPEN,
 *           proyecto no APPROVED o de otra feria, o feria sin rúbrica/criterios
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedResponse'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenResponse'
 *
 * /api/fairs/{id}/evaluations/{evaluationId}:
 *   put:
 *     tags: [Fair Evaluations]
 *     summary: Actualizar una evaluación (JURY, solo la propia)
 *     description: >
 *       Se permite actualizar la evaluación PROPIA mientras la feria esté OPEN
 *       y el jurado siga asignado. Si se envían scores se recalcula total_score.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/FairId'
 *       - in: path
 *         name: evaluationId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               comment:
 *                 type: string
 *                 maxLength: 5000
 *                 nullable: true
 *               scores:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [criterion_id, score]
 *                   properties:
 *                     criterion_id: { type: string, format: uuid }
 *                     score: { type: number }
 *     responses:
 *       200:
 *         description: Evaluación actualizada
 *       403:
 *         description: No es la evaluación del jurado autenticado
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedResponse'
 *
 * /api/fairs/my-evaluations:
 *   get:
 *     tags: [Fair Evaluations]
 *     summary: Evaluaciones del JURY autenticado
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: fair_id
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
 *     responses:
 *       200:
 *         description: Lista paginada de las evaluaciones del jurado
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedResponse'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenResponse'
 *
 * /api/fairs/{id}/jury/declaration:
 *   get:
 *     tags: [Fair Evaluations]
 *     summary: Consultar la declaración de imparcialidad del JURY autenticado
 *     description: >
 *       Devuelve si el jurado ya firmó y, en tal caso, la declaración completa.
 *       Requiere estar formalmente asignado a la feria.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/FairId'
 *     responses:
 *       200:
 *         description: Estado de la declaración del jurado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 fair_id: { type: string, format: uuid }
 *                 signed: { type: boolean }
 *                 declaration:
 *                   allOf:
 *                     - $ref: '#/components/schemas/FairJuryDeclaration'
 *                   nullable: true
 *       '403':
 *         $ref: '#/components/responses/ForbiddenResponse'
 *   post:
 *     tags: [Fair Evaluations]
 *     summary: Firmar la declaración de imparcialidad del JURY
 *     description: >
 *       Es PREREQUISITO para registrar evaluaciones en la feria. Solo se firma
 *       mientras la feria está en DRAFT u OPEN; una sola declaración por
 *       (feria, jurado); si ya existe, 409.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/FairId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [statement]
 *             additionalProperties: false
 *             properties:
 *               statement:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 2000
 *     responses:
 *       201:
 *         description: Declaración de jurado registrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FairJuryDeclaration'
 *       409:
 *         $ref: '#/components/responses/ConflictResponse'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedResponse'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenResponse'
 *
 * /api/fairs/my-progress/{fairId}:
 *   get:
 *     tags: [Fair Evaluations]
 *     summary: Panel de avance del JURY en una feria
 *     description: >
 *       Resumen derivado (no persiste nada): declaración firmada, proyectos
 *       APPROVED evaluables, evaluaciones propias, restantes y porcentaje de
 *       avance. Solo para el JURY formalmente asignado a la feria.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: fairId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Avance del jurado en la feria
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FairJuryProgress'
 *       403:
 *         $ref: '#/components/responses/ForbiddenResponse'
 *
 * components:
 *   parameters:
 *     FairId:
 *       in: path
 *       name: id
 *       required: true
 *       schema: { type: string, format: uuid }
 *       description: Identificador(s) de la feria
 */