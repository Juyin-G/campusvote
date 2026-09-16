/**
 * @file juryAssignment.docs.js
 * @description Documentación OpenAPI (Swagger) de asignación de jurados a
 * ferias académicas (dominio exclusivo de ferias; no se mezcla con el dominio
 * electoral de ratings/jury-assignments).
 * @openapi
 * components:
 *   schemas:
 *     FairJuryAssignment:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         fair_id:
 *           type: string
 *           format: uuid
 *         user_id:
 *           type: string
 *           format: uuid
 *         assigned_by:
 *           type: string
 *           format: uuid
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 *         user:
 *           type: object
 *           nullable: true
 *           properties:
 *             id:
 *               type: string
 *               format: uuid
 *             first_name:
 *               type: string
 *             last_name:
 *               type: string
 *             institutional_id:
 *               type: string
 *             role:
 *               type: string
 *               enum: [STUDENT, TEACHER, ADMIN, SUPERADMIN, JURY]
 *             status:
 *               type: string
 *               enum: [PENDING, ACTIVE, SUSPENDED, DELETED]
 *     FairJuryAssignmentFair:
 *       type: object
 *       properties:
 *         assigned_at:
 *           type: string
 *           format: date-time
 *         fair:
 *           type: object
 *           properties:
 *             id:
 *               type: string
 *               format: uuid
 *             organization_id:
 *               type: string
 *               format: uuid
 *             name:
 *               type: string
 *             description:
 *               type: string
 *               nullable: true
 *             status:
 *               type: string
 *               enum: [DRAFT, OPEN, CLOSED]
 *             starts_at:
 *               type: string
 *               format: date-time
 *               nullable: true
 *             ends_at:
 *               type: string
 *               format: date-time
 *               nullable: true
 */

/**
 * @openapi
 * /api/fairs/{id}/juries:
 *   get:
 *     tags: [FairJuries]
 *     summary: Listar jurados asignados a una feria (ADMIN)
 *     description: >
 *       Solo las ferias de la organización del ADMIN (aislamiento por tenant).
 *       No se exige estado de feria: es una consulta.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Jurados asignados
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedResponse'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenResponse'
 *   post:
 *     tags: [FairJuries]
 *     summary: Asignar un usuario JURY a una feria (ADMIN)
 *     description: >
 *       Valida en backend: el usuario debe tener rol global JURY, estar ACTIVE
 *       y pertenecer a la misma organización que la feria. La feria debe estar
 *       en DRAFT u OPEN. UNIQUE (fair_id, user_id) evita duplicados.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [user_id]
 *             properties:
 *               user_id:
 *                 type: string
 *                 format: uuid
 *             additionalProperties: false
 *     responses:
 *       201:
 *         description: Jurado asignado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FairJuryAssignment'
 *       '400':
 *         $ref: '#/components/responses/BadRequestResponse'
 *       '404':
 *         $ref: '#/components/responses/NotFoundResponse'
 *       '409':
 *         $ref: '#/components/responses/ConflictResponse'
 *
 * /api/fairs/{id}/juries/{userId}:
 *   get:
 *     tags: [FairJuries]
 *     summary: Consultar si un usuario está asignado como jurado de una feria
 *     description: >
 *       Devuelve la asignación (200) o 404 si el usuario no está asignado.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Asignación existente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FairJuryAssignment'
 *       '404':
 *         $ref: '#/components/responses/NotFoundResponse'
 *   delete:
 *     tags: [FairJuries]
 *     summary: Quitar un jurado de una feria (ADMIN)
 *     description: >
 *       La feria debe estar en DRAFT u OPEN; en CLOSED se bloquea.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Asignación eliminada
 *       '409':
 *         $ref: '#/components/responses/ConflictResponse'
 *
 * /api/fairs/my-assignments:
 *   get:
 *     tags: [FairJuries]
 *     summary: Ferias asignadas al JURY autenticado (solo rol JURY)
 *     description: >
 *       Devuelve ÚNICAMENTE las ferias donde el usuario tiene una asignación
 *       formal. NUNCA todas las ferias del sistema, ni permisos administrativos.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
 *     responses:
 *       200:
 *         description: Ferias asignadas (paginadas)
 *
 * /api/fairs/my-assignments/{fairId}:
 *   get:
 *     tags: [FairJuries]
 *     summary: Detalle básico de una feria asignada (solo rol JURY)
 *     description: >
 *       Solo accesible por el JURY asignado; 403 para ferias sin asignación.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: fairId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Detalle básico de la feria
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FairJuryAssignmentFair'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenResponse'
 */