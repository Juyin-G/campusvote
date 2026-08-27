// src/modules/elections/electionRules/electionRules.docs.js

/**
 * @swagger
 * tags:
 *   name: Reglas de Elección
 *   description: Configuración de reglas específicas (1:1) para un proceso electoral
 */

/**
 * @swagger
 * /api/elections/{electionId}/rules:
 *   get:
 *     summary: Obtener las reglas de una elección
 *     description: Recupera la configuración de reglas (quórum, votos en blanco, 2FA, etc.) para una elección específica.
 *     tags: [Reglas de Elección]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: electionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID de la elección
 *     responses:
 *       200:
 *         description: Reglas obtenidas exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Consulta exitosa"
 *                 data:
 *                   $ref: '#/components/schemas/ElectionRule'
 *                 meta:
 *                   type: object
 *                   properties:
 *                     requestId:
 *                       type: string
 *                       format: uuid
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: La elección no tiene reglas configuradas aún
 *         $ref: '#/components/responses/NotFound'
 *
 *   post:
 *     summary: Configurar las reglas de una elección
 *     description: Crea la configuración de reglas para una elección. Solo permitido en estados DRAFT o SCHEDULED. Relación 1:1, solo se puede crear una vez.
 *     tags: [Reglas de Elección]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: electionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ElectionRuleCreate'
 *     responses:
 *       201:
 *         description: Reglas configuradas exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Reglas de la elección configuradas correctamente."
 *                 data:
 *                   $ref: '#/components/schemas/ElectionRule'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         description: Conflicto (la elección ya tiene reglas configuradas)
 *         $ref: '#/components/responses/Conflict'
 *
 *   patch:
 *     summary: Modificar parcialmente las reglas de una elección
 *     description: Actualiza uno o más campos de las reglas existentes. Solo permitido en estados DRAFT o SCHEDULED. Requiere al menos un campo en el cuerpo.
 *     tags: [Reglas de Elección]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: electionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ElectionRuleUpdate'
 *     responses:
 *       200:
 *         description: Reglas actualizadas exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Reglas de la elección actualizadas correctamente."
 *                 data:
 *                   $ref: '#/components/schemas/ElectionRule'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         description: La elección no tiene reglas configuradas (usa POST primero)
 *         $ref: '#/components/responses/NotFound'
 *
 *   delete:
 *     summary: Eliminar las reglas de una elección
 *     description: Elimina la configuración personalizada, haciendo que la elección vuelva a usar los valores por defecto de la base de datos. Solo permitido en estados DRAFT o SCHEDULED.
 *     tags: [Reglas de Elección]
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
 *         description: Reglas eliminadas exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Reglas de la elección eliminadas correctamente."
 *                 data:
 *                   type: object
 *                   properties:
 *                     deleted:
 *                       type: boolean
 *                       example: true
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     ElectionRule:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         election_id:
 *           type: string
 *           format: uuid
 *         min_turnout_percentage:
 *           type: number
 *           format: float
 *           description: Porcentaje mínimo de participación requerido (0-100, máx 2 decimales)
 *           example: 50.00
 *         allow_blank_vote:
 *           type: boolean
 *           description: Permite votar en blanco
 *           example: true
 *         allow_null_vote:
 *           type: boolean
 *           description: Permite votos nulos
 *           example: true
 *         max_votes_per_position:
 *           type: integer
 *           description: Número máximo de votos que un elector puede emitir por cargo
 *           example: 1
 *         requires_2fa:
 *           type: boolean
 *           description: Exige autenticación de dos factores para votar
 *           example: true
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 *
 *     ElectionRuleCreate:
 *       type: object
 *       properties:
 *         min_turnout_percentage:
 *           type: number
 *           minimum: 0
 *           maximum: 100
 *           example: 50.00
 *         allow_blank_vote:
 *           type: boolean
 *         allow_null_vote:
 *           type: boolean
 *         max_votes_per_position:
 *           type: integer
 *           minimum: 1
 *           maximum: 32767
 *         requires_2fa:
 *           type: boolean
 *
 *     ElectionRuleUpdate:
 *       type: object
 *       minProperties: 1
 *       properties:
 *         min_turnout_percentage:
 *           type: number
 *           minimum: 0
 *           maximum: 100
 *         allow_blank_vote:
 *           type: boolean
 *         allow_null_vote:
 *           type: boolean
 *         max_votes_per_position:
 *           type: integer
 *           minimum: 1
 *           maximum: 32767
 *         requires_2fa:
 *           type: boolean
 */