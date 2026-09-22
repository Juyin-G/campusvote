// src/modules/audit/audit.tokens.docs.js
// OpenAPI: endpoints de one-time tokens.

/**
 * @openapi
 * /audit/tokens:
 *   post:
 *     summary: Crear token de un solo uso
 *     tags: [Audit]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId, electionId, expiresAt]
 *             properties:
 *               userId: { type: string, format: uuid }
 *               electionId: { type: string, format: uuid }
 *               expiresAt: { type: string, format: date-time }
 *     responses:
 *       201: { description: Token creado (raw) }
 *
 * /audit/tokens/consume:
 *   post:
 *     summary: Consumir token de un solo uso
 *     tags: [Audit]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [rawToken, electionId]
 *             properties:
 *               rawToken: { type: string }
 *               electionId: { type: string, format: uuid }
 *     responses:
 *       200: { description: Token consumido }
 *       410: { description: Token expirado }
 *       409: { description: Token ya utilizado }
 *
 * /audit/tokens/status:
 *   get:
 *     summary: Verificar estado del token (sin consumirlo)
 *     tags: [Audit]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: token
 *         schema: { type: string }
 *       - in: query
 *         name: electionId
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Estado del token }
 *
 * /audit/tokens/cleanup:
 *   delete:
 *     summary: Limpiar tokens expirados (admin/cron)
 *     tags: [Audit]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Resultado de la limpieza }
 */
