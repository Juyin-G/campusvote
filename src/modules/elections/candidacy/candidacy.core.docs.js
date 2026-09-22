// src/modules/elections/candidacy/candidacy.core.docs.js
// OpenAPI: CRUD de candidaturas.

/**
 * @openapi
 * /api/elections/{electionId}/candidacies:
 *   get:
 *     summary: Listar candidaturas de una elección
 *     tags: [Candidacies]
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
 *     summary: Crear candidatura
 *     tags: [Candidacies]
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
 *           schema: { $ref: '#/components/schemas/CreateCandidacyRequest' }
 *     responses:
 *       201: { description: Candidatura creada }
 *
 * /api/elections/{electionId}/candidacies/{id}:
 *   get:
 *     summary: Obtener candidatura por ID
 *     tags: [Candidacies]
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
 *       200: { description: Candidatura encontrada }
 *       404: { description: No encontrada }
 *   patch:
 *     summary: Actualizar candidatura
 *     tags: [Candidacies]
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
 *       200: { description: Candidatura actualizada }
 *   delete:
 *     summary: Eliminar candidatura
 *     tags: [Candidacies]
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
 *       200: { description: Candidatura eliminada }
 */
