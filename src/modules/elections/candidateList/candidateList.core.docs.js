// src/modules/elections/candidateList/candidateList.core.docs.js
// OpenAPI: /candidate-lists (CRUD).

/**
 * @openapi
 * /api/elections/{electionId}/candidate-lists:
 *   get:
 *     summary: Listar listas de candidatos de una elección
 *     tags: [CandidateLists]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: electionId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
 *     responses:
 *       200: { description: Lista paginada }
 *   post:
 *     summary: Crear lista de candidatos
 *     tags: [CandidateLists]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: electionId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/CreateCandidateListRequest' }
 *     responses:
 *       201: { description: Lista creada }
 *
 * /api/elections/{electionId}/candidate-lists/{id}:
 *   get:
 *     summary: Obtener lista de candidatos
 *     tags: [CandidateLists]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: electionId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Lista encontrada }
 *       404: { description: No encontrada }
 *   patch:
 *     summary: Actualizar lista de candidatos
 *     tags: [CandidateLists]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: electionId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { descripción: Lista actualizada }
 *   delete:
 *     summary: Eliminar lista de candidatos
 *     tags: [CandidateLists]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: electionId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Lista eliminada }
 */
