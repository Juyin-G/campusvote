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
 *     summary: Listar proyectos/listas candidatas de una elección (con filtros)
 *     description: "Obtiene los proyectos (listas candidatas) de una elección con filtros de búsqueda por proyecto: search (nombre/acrónimo/descripción), category, status de la candidatura, orden y paginación opcional. Sin limit se devuelven todas las listas (requerido por la papeleta)."
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
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Búsqueda parcial en nombre, acrónimo o descripción del proyecto
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filtra por categoría exacta del proyecto
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, APPROVED, REJECTED]
 *         description: Filtra por estado de la candidatura del proyecto
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [name, createdAt, rating]
 *         description: Orden de resultados (rating requiere withRatings=true)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 200
 *         description: Paginación (opcional, sin limit se devuelve la lista completa)
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *         description: Desplazamiento para paginación
 *       - in: query
 *         name: withRatings
 *         schema:
 *           type: boolean
 *         description: Adjunta ratings.count, ratings.average y latestComment de la feria
 *     responses:
 *       200:
 *         description: Lista de proyectos obtenida exitosamente
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
 *               description:
 *                 type: string
 *                 maxLength: 10000
 *                 nullable: true
 *                 description: Descripción del proyecto (usado en ferias/concursos)
 *                 example: "Proyecto de reciclaje con impacto en 3 facultades"
 *               imageUrl:
 *                 type: string
 *                 maxLength: 1000
 *                 nullable: true
 *                 description: URL de la imagen del proyecto
 *                 example: "https://example.com/uploads/proyecto.jpg"
 *               category:
 *                 type: string
 *                 maxLength: 80
 *                 nullable: true
 *                 description: Categoría del proyecto (filtro de búsqueda)
 *                 example: "Tecnología"
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *                 maxItems: 20
 *                 description: Etiquetas del proyecto para búsqueda
 *                 example: ["sostenibilidad", "2026-II"]
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
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
