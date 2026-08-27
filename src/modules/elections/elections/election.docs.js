// src/modules/elections/elections/election.docs.js

/**
 * @swagger
 * tags:
 *   name: Elecciones
 *   description: Gestión del ciclo de vida completo de los procesos electorales
 */

/**
 * @swagger
 * /api/elections:
 *   get:
 *     summary: Listar elecciones (paginado)
 *     description: Obtiene una lista paginada de elecciones, con filtros opcionales por estado, tipo de alcance, período, facultad, programa o texto de búsqueda.
 *     tags: [Elecciones]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Número de página
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Elementos por página
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [DRAFT, SCHEDULED, OPEN, CLOSED, CERTIFIED, PUBLISHED]
 *         description: Filtrar por estado de la elección
 *       - in: query
 *         name: scope_type
 *         schema:
 *           type: string
 *           enum: [UNIVERSITY, FACULTY, PROGRAM]
 *         description: Filtrar por tipo de alcance
 *       - in: query
 *         name: period_id
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filtrar por ID del período académico
 *       - in: query
 *         name: faculty_id
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filtrar por ID de facultad
 *       - in: query
 *         name: program_id
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filtrar por ID de programa
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *           maxLength: 100
 *         description: Buscar por título o descripción (insensible a mayúsculas)
 *     responses:
 *       200:
 *         description: Lista de elecciones obtenida exitosamente
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
 *                     $ref: '#/components/schemas/Election'
 *                 pagination:
 *                   $ref: '#/components/schemas/PaginationMeta'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
 *   post:
 *     summary: Crear una nueva elección
 *     description: Crea un nuevo proceso electoral. La elección nace en estado 'DRAFT'. Requiere que el creador esté autenticado.
 *     tags: [Elecciones]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ElectionCreate'
 *     responses:
 *       201:
 *         description: Elección creada exitosamente
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
 *                   example: "Elección creada exitosamente"
 *                 data:
 *                   $ref: '#/components/schemas/Election'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       409:
 *         description: Conflicto (ej. título ya existe o reglas de alcance violadas)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/responses/Conflict'
 */

/**
 * @swagger
 * /api/elections/{id}:
 *   get:
 *     summary: Obtener detalles de una elección
 *     description: Recupera la información completa de una elección específica por su ID.
 *     tags: [Elecciones]
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
 *     responses:
 *       200:
 *         description: Detalles de la elección
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
 *                   $ref: '#/components/schemas/Election'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *
 *   put:
 *     summary: Actualizar una elección (parcialmente)
 *     description: Modifica los datos de una elección existente. Solo permitido en estados 'DRAFT' o 'SCHEDULED'. Requiere al menos un campo en el cuerpo.
 *     tags: [Elecciones]
 *     security:
 *       - bearerAuth: []
 *     parameters:
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
 *             $ref: '#/components/schemas/ElectionUpdate'
 *     responses:
 *       200:
 *         description: Elección actualizada exitosamente
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
 *                   example: "Elección actualizada exitosamente"
 *                 data:
 *                   $ref: '#/components/schemas/Election'
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
 *     summary: Eliminar una elección
 *     description: Elimina una elección del sistema. Solo permitido en estados 'DRAFT' o 'SCHEDULED'. Reservado exclusivamente para el rol ADMIN.
 *     tags: [Elecciones]
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
 *         description: Elección eliminada exitosamente
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
 *                   example: "Elección eliminada exitosamente"
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
 *       409:
 *         description: Conflicto (la elección ya no está en estado editable)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/responses/Conflict'
 */

/**
 * @swagger
 * /api/elections/{id}/status:
 *   patch:
 *     summary: Cambiar el estado de una elección (Workflow)
 *     description: Avanza la elección al siguiente estado permitido en el workflow (ej. de DRAFT a SCHEDULED). La transición a 'CERTIFIED' ejecuta una función SQL transaccional de escrutinio.
 *     tags: [Elecciones]
 *     security:
 *       - bearerAuth: []
 *     parameters:
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
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [DRAFT, SCHEDULED, OPEN, CLOSED, CERTIFIED, PUBLISHED]
 *                 description: El nuevo estado al que se desea transicionar
 *     responses:
 *       200:
 *         description: Estado de la elección actualizado exitosamente
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
 *                   example: "Elección actualizada al estado OPEN"
 *                 data:
 *                   $ref: '#/components/schemas/Election'
 *       400:
 *         description: Bad Request (ej. intentar programar una elección sin cargos o con fechas pasadas)
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         description: Conflicto (transición de estado no permitida o ya se encuentra en ese estado)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/responses/Conflict'
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Election:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         title:
 *           type: string
 *         description:
 *           type: string
 *         process_type:
 *           type: string
 *           enum: [VOTE, FAIR, FEEDBACK, FORM]
 *         scope_type:
 *           type: string
 *           enum: [UNIVERSITY, FACULTY, PROGRAM]
 *         period_id:
 *           type: string
 *           format: uuid
 *         faculty_id:
 *           type: string
 *           format: uuid
 *           nullable: true
 *         program_id:
 *           type: string
 *           format: uuid
 *           nullable: true
 *         start_at:
 *           type: string
 *           format: date-time
 *         end_at:
 *           type: string
 *           format: date-time
 *         status:
 *           type: string
 *           enum: [DRAFT, SCHEDULED, OPEN, CLOSED, CERTIFIED, PUBLISHED]
 *         created_by:
 *           type: string
 *           format: uuid
 *         form_structure:
 *           type: object
 *           nullable: true
 *           description: Estructura JSON del formulario (requerida si process_type es 'FORM')
 *         is_anonymous_allowed:
 *           type: boolean
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 *
 *     ElectionCreate:
 *       type: object
 *       required:
 *         - title
 *         - scope_type
 *         - period_id
 *         - start_at
 *         - end_at
 *       properties:
 *         title:
 *           type: string
 *           maxLength: 255
 *         description:
 *           type: string
 *           maxLength: 5000
 *           default: ""
 *         process_type:
 *           type: string
 *           enum: [VOTE, FAIR, FEEDBACK, FORM]
 *           default: "VOTE"
 *         scope_type:
 *           type: string
 *           enum: [UNIVERSITY, FACULTY, PROGRAM]
 *         period_id:
 *           type: string
 *           format: uuid
 *         faculty_id:
 *           type: string
 *           format: uuid
 *           nullable: true
 *         program_id:
 *           type: string
 *           format: uuid
 *           nullable: true
 *         start_at:
 *           type: string
 *           format: date-time
 *         end_at:
 *           type: string
 *           format: date-time
 *         form_structure:
 *           type: object
 *           nullable: true
 *         is_anonymous_allowed:
 *           type: boolean
 *           default: false
 *
 *     ElectionUpdate:
 *       type: object
 *       minProperties: 1
 *       properties:
 *         title:
 *           type: string
 *           maxLength: 255
 *         description:
 *           type: string
 *           maxLength: 5000
 *         process_type:
 *           type: string
 *           enum: [VOTE, FAIR, FEEDBACK, FORM]
 *         scope_type:
 *           type: string
 *           enum: [UNIVERSITY, FACULTY, PROGRAM]
 *         period_id:
 *           type: string
 *           format: uuid
 *         faculty_id:
 *           type: string
 *           format: uuid
 *           nullable: true
 *         program_id:
 *           type: string
 *           format: uuid
 *           nullable: true
 *         start_at:
 *           type: string
 *           format: date-time
 *         end_at:
 *           type: string
 *           format: date-time
 *         form_structure:
 *           type: object
 *           nullable: true
 *         is_anonymous_allowed:
 *           type: boolean
 *
 *     PaginationMeta:
 *       type: object
 *       properties:
 *         page:
 *           type: integer
 *         limit:
 *           type: integer
 *         total:
 *           type: integer
 *         totalPages:
 *           type: integer
 */