// src/modules/voting/voting.docs.js
// Documentación OpenAPI del módulo de VOTACIÓN.

/**
 * @swagger
 * /voting/elections/{electionId}/sessions:
 *   post:
 *     tags: [Voting]
 *     summary: Inicia una sesión de votación
 *     description: >
 *       Crea una sesión de votación para el elector autenticado en una
 *       elección. La lógica transaccional (elección abierta, elegibilidad,
 *       voto único) se valida en la base de datos.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: electionId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       '201':
 *         description: Sesión de votación iniciada
 *       '403':
 *         description: Elector no elegible para esta elección
 *       '409':
 *         description: Elección cerrada o voto ya emitido
 */

/**
 * @swagger
 * /voting/sessions/{sessionId}/cast:
 *   post:
 *     tags: [Voting]
 *     summary: Emite un voto
 *     description: >
 *       Registra el voto del elector dentro de una sesión ya iniciada.
 *       Devuelve un comprobante de votación (receipt code).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [encryptedPayload, payloadHash]
 *             properties:
 *               encryptedPayload:
 *                 type: string
 *               payloadHash:
 *                 type: string
 *               selections:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     optionId: { type: string, format: uuid }
 *     responses:
 *       '200':
 *         description: Voto emitido correctamente
 *       '409':
 *         description: Sesión ya finalizada o voto ya emitido
 */

/**
 * @swagger
 * /voting/sessions/{id}:
 *   get:
 *     tags: [Voting]
 *     summary: Consulta el estado de una sesión de votación
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       '200':
 *         description: Estado de la sesión de votación
 *       '404':
 *         description: Sesión no encontrada
 */
