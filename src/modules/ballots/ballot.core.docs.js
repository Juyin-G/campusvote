// src/modules/ballots/ballot.core.docs.js
// OpenAPI: CRUD de ballots.

/**
 * @openapi
 * /api/ballots:
 *   get:
 *     summary: Listar ballots
 *     tags: [Ballots]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
 *     responses:
 *       200: { description: Lista paginada }
 *   post:
 *     summary: Crear ballot
 *     tags: [Ballots]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/CreateBallotRequest' }
 *     responses:
 *       201: { description: Ballot creado }
 *
 * /api/ballots/{id}:
 *   get:
 *     summary: Obtener ballot por ID
 *     tags: [Ballots]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Ballot encontrado }
 *       404: { description: No encontrado }
 *   patch:
 *     summary: Actualizar ballot
 *     tags: [Ballots]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Ballot actualizado }
 *   delete:
 *     summary: Eliminar ballot
 *     tags: [Ballots]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Ballot eliminado }
 */
