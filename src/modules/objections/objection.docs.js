/**
 * @swagger
 * tags:
 *   name: Objections
 *   description: Tachas e impugnaciones electorales sobre listas o candidaturas (plan peruano F3).
 */

/**
 * @swagger
 * /api/elections/{id}/objections:
 *   post:
 *     summary: Presentar una tacha o impugnación
 *     description: >
 *       Un elector presenta una tacha (lista/candidatura) o impugnación de resultados.
 *       Ventanas: TACHA_LIST/TACHA_CANDIDACY mientras la elección está SCHEDULED;
 *       IMPUGNACION_RESULT mientras está CLOSED/CERTIFIED. Máximo 1 pendiente por objetivo.
 *     tags: [Objections]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID de la elección
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - objection_type
 *               - reason
 *             properties:
 *               objection_type:
 *                 type: string
 *                 enum: [TACHA_LIST, TACHA_CANDIDACY, IMPUGNACION_RESULT]
 *               candidate_list_id:
 *                 type: string
 *                 format: uuid
 *                 description: Obligatorio para TACHA_LIST
 *               candidacy_id:
 *                 type: string
 *                 format: uuid
 *                 description: Obligatorio para TACHA_CANDIDACY/IMPUGNACION_RESULT
 *               reason:
 *                 type: string
 *                 maxLength: 2000
 *               evidence_urls:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uri
 *                 maxItems: 10
 *     responses:
 *       201:
 *         description: Objeción registrada
 *       409:
 *         description: Fuera de ventana, o ya existe pendiente para el objetivo
 *   get:
 *     summary: Listar tachas/impugnaciones de una elección
 *     tags: [Objections]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, FOUNDED, UNFOUNDED, WITHDRAWN]
 *       - in: query
 *         name: objection_type
 *         schema:
 *           type: string
 *           enum: [TACHA_LIST, TACHA_CANDIDACY, IMPUGNACION_RESULT]
 *     responses:
 *       200:
 *         description: Lista de objeciones
 */

/**
 * @swagger
 * /api/elections/{id}/objections/{objectionId}/resolve:
 *   put:
 *     summary: Resolver una objeción (comisión electoral)
 *     tags: [Objections]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID de la elección
 *       - in: path
 *         name: objectionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID de la objeción
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - resolution
 *             properties:
 *               resolution:
 *                 type: string
 *                 enum: [FOUNDED, UNFOUNDED]
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Objeción resuelta
 *       409:
 *         description: Solo pendientes o ventana no aplicable
 */