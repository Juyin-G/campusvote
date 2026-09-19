// src/modules/ballots/ballot.lookup.docs.js
// OpenAPI: lookup + completeness.

/**
 * @openapi
 * /api/ballots/election/{electionId}/active:
 *   get:
 *     summary: Obtener el ballot activo de una elección
 *     tags: [Ballots]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: electionId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Ballot activo }
 *       404: { description: Sin ballot activo }
 *
 * /api/ballots/election/{electionId}/version:
 *   get:
 *     summary: Versión actual del ballot
 *     tags: [Ballots]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: electionId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Versión actual }
 *
 * /api/ballots/{id}/completeness:
 *   get:
 *     summary: Validar completitud del ballot
 *     tags: [Ballots]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Resultado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/BallotCompleteness' }
 */
