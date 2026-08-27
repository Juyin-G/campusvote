// src/modules/elections/candidacy/candidacy.docs.js

/**
 * @swagger
 * tags:
 *   name: Candidaturas
 *   description: Gestión de candidaturas dentro de un proceso electoral
 */

/**
 * @swagger
 * /api/elections/{electionId}/candidacies:
 *   get:
 *     summary: Listar candidaturas de una elección
 *     description: Obtiene la lista completa de candidaturas para una elección específica. Se puede filtrar por lista o cargo. No se usa paginación para facilitar la generación de la papeleta.
 *     tags: [Candidaturas]
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
 *       - in: query
 *         name: candidate_list_id
 *         required: false
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filtrar por ID de lista de candidatos
 *       - in: query
 *         name: position_id
 *         required: false
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filtrar por ID de cargo
 *     responses:
 *       200:
 *         description: Lista de candidaturas obtenida exitosamente
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
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Candidacy'
 *                 meta:
 *                   type: object
 *                   properties:
 *                     requestId:
 *                       type: string
 *                       format: uuid
 *                     total:
 *                       type: integer
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *
 *   post:
 *     summary: Registrar una nueva candidatura
 *     description: Crea una nueva candidatura para un usuario dentro de una lista y elección específicas. Solo permitido en estados DRAFT o SCHEDULED.
 *     tags: [Candidaturas]
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - candidate_list_id
 *               - user_id
 *             properties:
 *               candidate_list_id:
 *                 type: string
 *                 format: uuid
 *                 description: ID de la lista de candidatos a la que pertenece
 *               user_id:
 *                 type: string
 *                 format: uuid
 *                 description: ID del usuario que será candidato
 *               position_id:
 *                 type: string
 *                 format: uuid
 *                 nullable: true
 *                 description: ID del cargo al que postula (opcional si la lista postula a todos los cargos o es una elección de lista cerrada)
 *               order_index:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 32767
 *                 default: 1
 *                 description: Orden de aparición en la papeleta
 *               is_principal:
 *                 type: boolean
 *                 default: true
 *                 description: Indica si es el candidato principal para este cargo en la lista
 *     responses:
 *       201:
 *         description: Candidatura creada exitosamente
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
 *                   example: "Candidatura creada exitosamente"
 *                 data:
 *                   $ref: '#/components/schemas/Candidacy'
 *                 meta:
 *                   type: object
 *                   properties:
 *                     requestId:
 *                       type: string
 *                       format: uuid
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         description: Conflicto (ej. usuario ya es candidato, o ya existe un principal para ese cargo)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/responses/Conflict'
 */

/**
 * @swagger
 * /api/elections/{electionId}/candidacies/{id}:
 *   get:
 *     summary: Obtener detalles de una candidatura específica
 *     description: Recupera la información detallada de una candidatura, incluyendo los datos básicos del usuario candidato.
 *     tags: [Candidaturas]
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
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID de la candidatura
 *     responses:
 *       200:
 *         description: Detalles de la candidatura
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
 *                   $ref: '#/components/schemas/Candidacy'
 *                 meta:
 *                   type: object
 *                   properties:
 *                     requestId:
 *                       type: string
 *                       format: uuid
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *
 *   put:
 *     summary: Actualizar una candidatura (parcialmente)
 *     description: Modifica los datos de una candidatura existente. Solo permitido en estados DRAFT o SCHEDULED. El user_id es inmutable.
 *     tags: [Candidaturas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: electionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             minProperties: 1
 *             properties:
 *               candidate_list_id:
 *                 type: string
 *                 format: uuid
 *               position_id:
 *                 type: string
 *                 format: uuid
 *                 nullable: true
 *               order_index:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 32767
 *               is_principal:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Candidatura actualizada exitosamente
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
 *                   example: "Candidatura actualizada exitosamente"
 *                 data:
 *                   $ref: '#/components/schemas/Candidacy'
 *                 meta:
 *                   type: object
 *                   properties:
 *                     requestId:
 *                       type: string
 *                       format: uuid
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 *
 *   delete:
 *     summary: Retirar/Eliminar una candidatura
 *     description: Elimina una candidatura del proceso. Solo permitido en estados DRAFT o SCHEDULED.
 *     tags: [Candidaturas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: electionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Candidatura eliminada exitosamente
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
 *                   example: "Candidatura retirada exitosamente"
 *                 data:
 *                   type: object
 *                   properties:
 *                     deleted:
 *                       type: boolean
 *                       example: true
 *                 meta:
 *                   type: object
 *                   properties:
 *                     requestId:
 *                       type: string
 *                       format: uuid
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         description: Conflicto (ej. la elección ya está en estado OPEN o superior)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/responses/Conflict'
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Candidacy:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         election_id:
 *           type: string
 *           format: uuid
 *         candidate_list_id:
 *           type: string
 *           format: uuid
 *         position_id:
 *           type: string
 *           format: uuid
 *           nullable: true
 *         user_id:
 *           type: string
 *           format: uuid
 *         status:
 *           type: string
 *           enum: [PENDING, APPROVED, REJECTED]
 *           description: Estado de revisión de la candidatura
 *         order_index:
 *           type: integer
 *           description: Orden de aparición en la papeleta
 *         is_principal:
 *           type: boolean
 *           description: Indica si es el candidato principal para el cargo
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 *         user:
 *           type: object
 *           nullable: true
 *           description: Resumen del usuario candidato
 *           properties:
 *             id:
 *               type: string
 *               format: uuid
 *             username:
 *               type: string
 *             first_name:
 *               type: string
 *             last_name:
 *               type: string
 *             institutional_id:
 *               type: string
 */