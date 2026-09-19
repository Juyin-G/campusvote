/**
 * @file project.members.docs.js
 * Endpoints OpenAPI: gestión de integrantes del proyecto.
 */

/**
 * @openapi
 * /api/projects/{id}/members:
 *   get:
 *     tags: [Projects]
 *     summary: Listar integrantes del proyecto
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Integrantes
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 project_id: { type: string, format: uuid }
 *                 members:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/ProjectMember' }
 *   post:
 *     tags: [Projects]
 *     summary: Agregar integrante (propietario, en DRAFT o REJECTED)
 *     description: El usuario debe pertenecer a la misma organización.
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
 *             required: [user_id]
 *             properties:
 *               user_id: { type: string, format: uuid }
 *               role:
 *                 type: string
 *                 enum: [EXPOSITOR, COLLABORATOR, ADVISOR]
 *                 default: EXPOSITOR
 *             additionalProperties: false
 *     responses:
 *       201:
 *         description: Integrante agregado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ProjectMember' }
 *       403: { $ref: '#/components/responses/ForbiddenResponse' }
 *       409: { $ref: '#/components/responses/ConflictResponse' }
 *
 * /api/projects/{id}/members/{userId}:
 *   delete:
 *     tags: [Projects]
 *     summary: Quitar integrante (propietario, en DRAFT o REJECTED)
 *     security: [{ bearerAuth: [] }]
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
 *         description: Integrante removido
 *       404: { $ref: '#/components/responses/NotFoundResponse' }
 */
