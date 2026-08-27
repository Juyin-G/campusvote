// src/modules/elections/candidateList/candidateList.docs.js

/**
 * @swagger
 * tags:
 *   name: Listas Candidatas
 *   description: Gestión de listas de candidatos dentro de un proceso electoral
 */

/**
 * @swagger
 * /api/elections/{electionId}/candidate-lists:
 *   get:
 *     summary: Listar listas candidatas de una elección
 *     description: Obtiene todas las listas candidatas registradas para una elección específica. No se usa paginación para facilitar la generación de la papeleta.
 *     tags: [Listas Candidatas]
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
 *                     $ref: '#/components/schemas/CandidateList'
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
 *     summary: Registrar una nueva lista candidata
 *     description: Crea una nueva lista de candidatos para una elección. Solo permitido cuando la elección está en estado DRAFT (o SCHEDULED, según configuración).
 *     tags: [Listas Candidatas]
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
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 maxLength: 120
 *                 description: Nombre de la lista candidata (no puede estar vacío)
 *                 example: "Lista Unidad Estudiantil"
 *               acronym:
 *                 type: string
 *                 maxLength: 20
 *                 nullable: true
 *                 description: Acrónimo de la lista (opcional)
 *                 example: "LUE"
 *               motto:
 *                 type: string
 *                 maxLength: 255
 *                 nullable: true
 *                 description: Lema o eslogan de la lista (opcional)
 *                 example: "Juntos por el cambio"
 *               logo:
 *                 type: string
 *                 maxLength: 500
 *                 nullable: true
 *                 description: URL del logo de la lista (opcional)
 *                 example: "https://example.com/logos/lue.png"
 *     responses:
 *       201:
 *         description: Lista candidata creada exitosamente
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
 *                   example: "Lista candidata creada correctamente."
 *                 data:
 *                   $ref: '#/components/schemas/CandidateList'
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
 *         description: Conflicto (ej. ya existe una lista con ese nombre o acrónimo)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/responses/Conflict'
 */

/**
 * @swagger
 * /api/elections/{electionId}/candidate-lists/{id}:
 *   get:
 *     summary: Obtener detalles de una lista candidata específica
 *     description: Recupera la información detallada de una lista candidata por su ID.
 *     tags: [Listas Candidatas]
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
 *         description: ID de la lista candidata
 *     responses:
 *       200:
 *         description: Detalles de la lista candidata
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
 *                   $ref: '#/components/schemas/CandidateList'
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
 *     summary: Actualizar una lista candidata (parcialmente)
 *     description: Modifica los datos de una lista candidata existente. Solo permitido en estados DRAFT (o SCHEDULED). Requiere al menos un campo en el cuerpo de la solicitud.
 *     tags: [Listas Candidatas]
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
 *               name:
 *                 type: string
 *                 maxLength: 120
 *               acronym:
 *                 type: string
 *                 maxLength: 20
 *                 nullable: true
 *               motto:
 *                 type: string
 *                 maxLength: 255
 *                 nullable: true
 *               logo:
 *                 type: string
 *                 maxLength: 500
 *                 nullable: true
 *     responses:
 *       200:
 *         description: Lista candidata actualizada exitosamente
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
 *                   example: "Lista candidata actualizada correctamente."
 *                 data:
 *                   $ref: '#/components/schemas/CandidateList'
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
 *     summary: Eliminar una lista candidata
 *     description: Elimina una lista candidata del proceso. Solo permitido en estado DRAFT (o SCHEDULED) y **si no tiene candidaturas asociadas** (para evitar borrado en cascada accidental).
 *     tags: [Listas Candidatas]
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
 *         description: Lista candidata eliminada exitosamente
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
 *                   example: "Lista candidata eliminada correctamente."
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
 *         description: Conflicto (ej. la elección ya está abierta o la lista tiene candidaturas asociadas)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/responses/Conflict'
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     CandidateList:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         election_id:
 *           type: string
 *           format: uuid
 *         name:
 *           type: string
 *           description: Nombre de la lista
 *         acronym:
 *           type: string
 *           nullable: true
 *           description: Acrónimo de la lista
 *         motto:
 *           type: string
 *           nullable: true
 *           description: Lema o eslogan
 *         logo:
 *           type: string
 *           nullable: true
 *           description: URL del logo
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 */