// src/modules/elections/elections/election.core.docs.js
// OpenAPI: CRUD de elecciones.

/**
 * @openapi
 * /api/elections:
 *   get:
 *     summary: Listar elecciones
 *     tags: [Elections]
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
 *           enum: [DRAFT, SCHEDULED, OPEN, CLOSED, CERTIFIED]
 *     responses:
 *       200: { description: Lista paginada }
 *   post:
 *     summary: Crear elección
 *     tags: [Elections]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/CreateElectionRequest' }
 *     responses:
 *       201: { description: Elección creada }
 *
 * /api/elections/{id}:
 *   get:
 *     summary: Obtener elección por ID
 *     tags: [Elections]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Elección encontrada }
 *       404: { description: No encontrada }
 *   patch:
 *     summary: Actualizar elección
 *     tags: [Elections]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Elección actualizada }
 *   delete:
 *     summary: Eliminar elección
 *     tags: [Elections]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Elección eliminada }
 */
