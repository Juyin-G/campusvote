/**
 * @openapi
 * components:
 *   schemas:
 *     ElectionIdParam:
 *       type: object
 *       required: [id]
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: UUID de la elección.
 *
 *     TallySummary:
 *       type: object
 *       properties:
 *         election_id: { type: string, format: uuid }
 *         deleted: { type: integer }
 *         inserted: { type: integer }
 *         options_processed: { type: integer }
 *         positions_processed: { type: integer }
 *
 *     TallyOption:
 *       type: object
 *       properties:
 *         option_id: { type: string, format: uuid }
 *         label: { type: string }
 *         option_type:
 *           type: string
 *           enum: [CANDIDATE_LIST, BLANK, VOID]
 *         candidate_list_id: { type: string, format: uuid, nullable: true }
 *         votes_count: { type: integer }
 *         percentage: { type: number, format: float }
 *
 *     TallyPosition:
 *       type: object
 *       properties:
 *         position_id: { type: string, format: uuid }
 *         position_name: { type: string }
 *         seats: { type: integer }
 *         options:
 *           type: array
 *           items: { $ref: '#/components/schemas/TallyOption' }
 *
 *     ResultsDetail:
 *       type: object
 *       properties:
 *         positions:
 *           type: array
 *           items: { $ref: '#/components/schemas/TallyPosition' }
 *
 *     ResultsResponse:
 *       type: object
 *       properties:
 *         election_id: { type: string, format: uuid }
 *         status:
 *           type: string
 *           enum: [DRAFT, SCHEDULED, OPEN, CLOSED, CERTIFIED, PUBLISHED]
 *         summary: { type: object, nullable: true }
 *         detail: { $ref: '#/components/schemas/ResultsDetail' }
 */

/**
 * @openapi
 * /api/elections/{id}/certify:
 *   post:
 *     tags: [Results]
 *     summary: Certificar elección cerrada
 *     description: >
 *       Ejecuta certify_election() sobre la elección indicada y
 *       registra CERTIFY_RESULT en la auditoría.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Elección certificada }
 *       404: { description: La elección no existe }
 *       409: { description: La elección no está en estado CLOSED }
 */

/**
 * @openapi
 * /api/elections/{id}/publish:
 *   post:
 *     tags: [Results]
 *     summary: Publicar resultados certificados
 *     description: >
 *       Cambia la elección a PUBLISHED si cumple el quórum
 *       (turnout_percentage >= min_turnout_percentage) y registra
 *       PUBLISH_RESULT en la auditoría.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Elección publicada }
 *       404: { description: La elección no existe }
 *       409: { description: No está CERTIFIED o no cumple quórum }
 */

/**
 * @openapi
 * /api/elections/{id}/tally/recalculate:
 *   post:
 *     tags: [Results]
 *     summary: Recalcular conteo de votos
 *     description: >
 *       Sustituye atómicamente los tallies de la elección a partir
 *       de vote_selections. Solo permitido si la elección está CLOSED.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200:
 *         description: Recálculo completado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/TallySummary' }
 *       404: { description: La elección no existe }
 *       409: { description: La elección no está en estado CLOSED }
 */

/**
 * @openapi
 * /api/elections/{id}/tally:
 *   get:
 *     tags: [Results]
 *     summary: Obtener tallies actuales
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Lista de tallies }
 */

/**
 * @openapi
 * /api/results/live:
 *   get:
 *     tags: [Results]
 *     summary: Resultados en vivo
 *     description: >
 *       Devuelve resultados para elecciones en estado CLOSED,
 *       CERTIFIED o PUBLISHED.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: election_id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200:
 *         description: Resultados en vivo
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ResultsResponse' }
 *       404: { description: La elección no existe }
 *       409: { description: Estado no permitido para live }
 */

/**
 * @openapi
 * /api/results/final:
 *   get:
 *     tags: [Results]
 *     summary: Resultados finales
 *     description: >
 *       Devuelve resultados únicamente si la elección está
 *       en estado PUBLISHED.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: election_id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200:
 *         description: Resultados finales
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ResultsResponse' }
 *       404: { description: No disponibles / elección no publicada }
 */

/**
 * @openapi
 * /api/elections/{id}/report.pdf:
 *   get:
 *     tags: [Results]
 *     summary: Descargar acta de resultados en PDF
 *     description: >
 *       Devuelve el PDF del acta de resultados para una elección
 *       en estado PUBLISHED. El header X-Content-Hash expone
 *       el SHA-256 del PDF para verificación de integridad.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200:
 *         description: PDF generado
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *         headers:
 *           X-Content-Hash:
 *             description: SHA-256 del PDF en hexadecimal.
 *             schema: { type: string }
 *       404: { description: La elección no está publicada o no existe }
 */

/**
 * @openapi
 * /api/elections/{id}/export.csv:
 *   get:
 *     tags: [Results]
 *     summary: Exportar resultados a CSV
 *     description: >
 *       Devuelve los resultados en formato CSV con BOM UTF-8
 *       y protección frente a Formula Injection. Disponible solo
 *       para elecciones en estado PUBLISHED.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200:
 *         description: CSV generado
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *               example: |
 *                 election_id,position_id,position_name,option_id,option_label,option_type,candidate_list_id,votes_count,percentage
 *       404: { description: La elección no está publicada o no existe }
 */

/**
 * @openapi
 * /api/elections/{id}/export.xlsx:
 *   get:
 *     tags: [Results]
 *     summary: Exportar resultados a XLSX
 *     description: >
 *       Devuelve los resultados en formato Excel (.xlsx) con
 *       encabezados en negrita y fila congelada. Disponible solo
 *       para elecciones en estado PUBLISHED.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200:
 *         description: XLSX generado
 *         content:
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 *       404: { description: La elección no está publicada o no existe }
 */
