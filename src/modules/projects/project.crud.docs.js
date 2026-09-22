/**
 * @file project.crud.docs.js
 * Endpoints OpenAPI: GET / POST / PUT /api/projects y GET /api/projects/{id}.
 */

/**
 * @openapi
 * /api/projects:
 *   get:
 *     tags: [Projects]
 *     summary: Listar proyectos visibles para el usuario
 *     description: >
 *       ADMIN ve todos los de su organización. No-admin ve los suyos y los
 *       APPROVED. SUPERADMIN NO tiene acceso operativo (403).
 *     security: [{ bearerAuth: [] }]
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
 *           enum: [DRAFT, SUBMITTED, APPROVED, REJECTED]
 *       - in: query
 *         name: fair_id
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *     responses:
 *       200: { description: Lista paginada }
 *       401: { $ref: '#/components/responses/UnauthorizedResponse' }
 *       403: { $ref: '#/components/responses/ForbiddenResponse' }
 *   post:
 *     tags: [Projects]
 *     summary: Crear proyecto (STUDENT/TEACHER propietario)
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fair_id, name]
 *             properties:
 *               fair_id:
 *                 type: string
 *                 format: uuid
 *                 description: Feria de la organización (DRAFT u OPEN)
 *               name: { type: string, minLength: 3, maxLength: 200 }
 *               description: { type: string, maxLength: 5000 }
 *               logo_url: { type: string, format: uri }
 *               cover_url: { type: string, format: uri }
 *               project_url: { type: string, format: uri }
 *             additionalProperties: false
 *     responses:
 *       201:
 *         description: Proyecto creado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Project' }
 *       401: { $ref: '#/components/responses/UnauthorizedResponse' }
 *       403: { $ref: '#/components/responses/ForbiddenResponse' }
 *
 * /api/projects/{id}:
 *   get:
 *     tags: [Projects]
 *     summary: Obtener un proyecto con integrantes
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Detalle del proyecto
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Project' }
 *       404: { $ref: '#/components/responses/NotFoundResponse' }
 *   put:
 *     tags: [Projects]
 *     summary: Editar proyecto (solo propietario, en DRAFT o REJECTED)
 *     security: [{ bearerAuth: [] }]
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
 *               fair_id:
 *                 type: string
 *                 format: uuid
 *                 description: Nueva feria (misma organización, DRAFT u OPEN)
 *               name: { type: string, minLength: 3, maxLength: 200 }
 *               description: { type: string, maxLength: 5000 }
 *               logo_url: { type: string, format: uri }
 *               cover_url: { type: string, format: uri }
 *               project_url: { type: string, format: uri }
 *             additionalProperties: false
 *     responses:
 *       200:
 *         description: Proyecto actualizado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Project' }
 */
