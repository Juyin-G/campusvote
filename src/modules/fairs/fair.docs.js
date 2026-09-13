/**
 * @file fair.docs.js
 * @description Documentación OpenAPI (Swagger) del módulo de ferias académicas.
 * @openapi
 * components:
 *   schemas:
 *     Fair:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         organization_id:
 *           type: string
 *           format: uuid
 *         name:
 *           type: string
 *         description:
 *           type: string
 *           nullable: true
 *         status:
 *           type: string
 *           enum: [DRAFT, OPEN, CLOSED]
 *           description: >
 *             DRAFT = en configuración; OPEN = abierta/activa;
 *             CLOSED = finalizada.
 *         starts_at:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         ends_at:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         project_count:
 *           type: integer
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 */

/**
 * @openapi
 * /api/fairs:
 *   get:
 *     tags: [Fairs]
 *     summary: Listar ferias de la organización (ADMIN/SUPERADMIN)
 *     description: >
 *       ADMIN ve las ferias de su organización. SUPERADMIN conserva el bypass
 *       de tenant global del sistema (sin capacidades nuevas de gestión).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [DRAFT, OPEN, CLOSED]
 *     responses:
 *       200:
 *         description: Lista paginada de ferias
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedResponse'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenResponse'
 *   post:
 *     tags: [Fairs]
 *     summary: Crear feria (ADMIN, se crea en estado DRAFT)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 200
 *               description:
 *                 type: string
 *                 maxLength: 5000
 *               starts_at:
 *                 type: string
 *                 format: date-time
 *               ends_at:
 *                 type: string
 *                 format: date-time
 *             additionalProperties: false
 *     responses:
 *       201:
 *         description: Feria creada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Fair'
 *
 * /api/fairs/{id}:
 *   get:
 *     tags: [Fairs]
 *     summary: Obtener una feria
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Detalle de la feria
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Fair'
 *       '404':
 *         $ref: '#/components/responses/NotFoundResponse'
 *   put:
 *     tags: [Fairs]
 *     summary: Editar feria (solo en DRAFT u OPEN)
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
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 200
 *               description:
 *                 type: string
 *                 maxLength: 5000
 *               starts_at:
 *                 type: string
 *                 format: date-time
 *                 nullable: true
 *               ends_at:
 *                 type: string
 *                 format: date-time
 *                 nullable: true
 *             additionalProperties: false
 *     responses:
 *       200:
 *         description: Feria actualizada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Fair'
 *       '409':
 *         $ref: '#/components/responses/ConflictResponse'
 *
 * /api/fairs/{id}/status:
 *   post:
 *     tags: [Fairs]
 *     summary: Cambiar estado de la feria
 *     description: >
 *       Transiciones permitidas: DRAFT→OPEN, OPEN→DRAFT, OPEN→CLOSED.
 *       CLOSED es un estado terminal.
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
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [DRAFT, OPEN, CLOSED]
 *             additionalProperties: false
 *     responses:
 *       200:
 *         description: Estado actualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Fair'
 *       '409':
 *         $ref: '#/components/responses/ConflictResponse'
 */