// src/modules/audit/audit.logs.docs.js
// OpenAPI: endpoints de logs.

/**
 * @openapi
 * /audit/verify:
 *   get:
 *     summary: Verifica la integridad de la cadena de hashes
 *     tags: [Audit]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Resultado de la verificación }
 *
 * /audit/logs:
 *   get:
 *     summary: Consultar logs con filtros
 *     tags: [Audit]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: action
 *         schema: { type: string }
 *       - in: query
 *         name: actorId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: fromDate
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: toDate
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
 *     responses:
 *       200:
 *         description: Lista paginada de logs
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/AuditLog' }
 *                 pagination: { $ref: '#/components/schemas/PaginationMeta' }
 *   post:
 *     summary: Registrar nueva acción de auditoría
 *     tags: [Audit]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [action]
 *             properties:
 *               action: { type: string }
 *               metadata: { type: object }
 *     responses:
 *       201: { description: Log creado }
 *
 * /audit/logs/{id}:
 *   get:
 *     summary: Obtener un log específico
 *     tags: [Audit]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Log encontrado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/AuditLog' }
 *       404: { description: No encontrado }
 */
