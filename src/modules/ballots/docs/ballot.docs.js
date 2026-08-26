// src/modules/ballots/docs/ballot.docs.js
// S5-07 — Documentación Swagger del módulo Ballots.

/**
 * @openapi
 * components:
 *   schemas:
 *
 *     Ballot:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         election_id:
 *           type: string
 *           format: uuid
 *         version:
 *           type: integer
 *           minimum: 1
 *         is_active:
 *           type: boolean
 *         generated_at:
 *           type: string
 *           format: date-time
 *
 *     BallotPosition:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         ballot_id:
 *           type: string
 *           format: uuid
 *         position_id:
 *           type: string
 *           format: uuid
 *         order_index:
 *           type: integer
 *           minimum: 1
 *
 *     BallotOptionType:
 *       type: string
 *       enum:
 *         - CANDIDATE_LIST
 *         - BLANK
 *         - NULL
 *
 *     BallotOption:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         ballot_position_id:
 *           type: string
 *           format: uuid
 *         option_type:
 *           $ref: '#/components/schemas/BallotOptionType'
 *         candidate_list_id:
 *           type: string
 *           format: uuid
 *           nullable: true
 *         label:
 *           type: string
 *           maxLength: 120
 */

/**
 * @openapi
 * /api/ballots:
 *   get:
 *     summary: Listar boletas de una elección
 *     tags: [Ballots]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: election_id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *           maximum: 100
 *     responses:
 *       200:
 *         description: Lista paginada de boletas
 *
 *   post:
 *     summary: Crear una boleta
 *     tags: [Ballots]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - election_id
 *             properties:
 *               election_id:
 *                 type: string
 *                 format: uuid
 *               version:
 *                 type: integer
 *                 minimum: 1
 *               is_active:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Boleta creada correctamente
 *       403:
 *         description: Requiere ADMIN o ELECTORAL_COMMISSION
 */

/**
 * @openapi
 * /api/ballots/{id}:
 *   get:
 *     summary: Obtener una boleta
 *     tags: [Ballots]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Boleta encontrada
 *       404:
 *         description: Boleta no encontrada
 *
 *   put:
 *     summary: Actualizar una boleta
 *     tags: [Ballots]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Boleta actualizada
 *
 *   delete:
 *     summary: Eliminar una boleta
 *     tags: [Ballots]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Boleta eliminada
 */

/**
 * @openapi
 * /api/ballots/election/{electionId}/active:
 *   get:
 *     summary: Obtener la boleta activa de una elección
 *     tags: [Ballots]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: electionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Boleta activa encontrada
 *       404:
 *         description: No existe una boleta activa
 */

/**
 * @openapi
 * /api/ballots/election/{electionId}/version:
 *   post:
 *     summary: Crear una nueva versión de la boleta
 *     description: >
 *       Utiliza create_ballot_version(). La versión activa anterior
 *       queda desactivada y se crea una nueva versión activa.
 *     tags: [Ballots]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: electionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       201:
 *         description: Nueva versión creada
 */

/**
 * @openapi
 * /api/ballots/{id}/completeness:
 *   get:
 *     summary: Validar integridad de una boleta
 *     description: >
 *       Verifica mediante validate_ballot_completeness()
 *       que cada posición tenga al menos una opción.
 *     tags: [Ballots]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Resultado de validación
 */