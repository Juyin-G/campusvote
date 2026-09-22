// src/modules/elections/elections/election.lifecycle.docs.js
// OpenAPI: cambios de estado de elección (open/close/certify).

/**
 * @openapi
 * /api/elections/{id}/status:
 *   patch:
 *     summary: Cambiar estado de elección
 *     description: Transiciones: DRAFT→SCHEDULED, SCHEDULED→OPEN, OPEN→CLOSED, CLOSED→CERTIFIED.
 *     tags: [Elections]
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
 *           schema: { $ref: '#/components/schemas/ChangeElectionStatusRequest' }
 *     responses:
 *       200: { description: Estado actualizado }
 *       409: { description: Transición no permitida }
 *
 * /api/elections/{id}/publish-results:
 *   post:
 *     summary: Publicar resultados oficiales
 *     tags: [Elections]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Resultados publicados }
 */
