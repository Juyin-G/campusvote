// src/modules/ballots/ballotPositions/ballotPositions.routes.docs.js
// OpenAPI: CRUD de cargos del ballot.

/**
 * @openapi
 * /api/ballots/{ballotId}/positions:
 *   get:
 *     summary: Listar cargos del ballot
 *     tags: [BallotPositions]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: ballotId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Lista de cargos }
 *   post:
 *     summary: Crear cargo en el ballot
 *     tags: [BallotPositions]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: ballotId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/CreateBallotPositionRequest' }
 *     responses:
 *       201: { description: Cargo creado }
 *
 * /api/ballots/{ballotId}/positions/{id}:
 *   get:
 *     summary: Obtener cargo del ballot
 *     tags: [BallotPositions]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: ballotId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Cargo encontrado }
 *       404: { description: No encontrado }
 *   patch:
 *     summary: Actualizar cargo del ballot
 *     tags: [BallotPositions]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: ballotId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Cargo actualizado }
 *   delete:
 *     summary: Eliminar cargo del ballot
 *     tags: [BallotPositions]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: ballotId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Cargo eliminado }
 */
