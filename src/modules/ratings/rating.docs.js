/**
 * @swagger
 * tags:
 *   name: Ratings
 *   description: Calificación por estrellas (1-5) para proyectos de ferias académicas y concursos.
 */

/**
 * @swagger
 * /api/elections/{id}/ratings/{candidacyId}:
 *   post:
 *     summary: Calificar un proyecto
 *     description: Permite a un jurado calificar un proyecto (1-5 estrellas) y dejar un comentario opcional.
 *     tags: [Ratings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID de la elección (Feria o Concurso)
 *       - in: path
 *         name: candidacyId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID de la candidatura/proyecto a calificar
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - score
 *             properties:
 *               score:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *                 description: Puntuación en estrellas del 1 al 5
 *               comment:
 *                 type: string
 *                 maxLength: 1000
 *                 description: Comentario o feedback (opcional)
 *     responses:
 *       200:
 *         description: Calificación registrada o actualizada correctamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *       400:
 *         description: Datos inválidos
 *       403:
 *         description: No autorizado o IDOR detectado
 */

/**
 * @swagger
 * /api/elections/{id}/ratings/results:
 *   get:
 *     summary: Obtener resultados de calificaciones
 *     description: Obtiene el promedio y el total de estrellas de todos los proyectos de una feria.
 *     tags: [Ratings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID de la elección (Feria o Concurso)
 *     responses:
 *       200:
 *         description: Resultados de la feria (Ranking)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 */

/**
 * @swagger
 * /api/elections/{id}/ratings:
 *   get:
 *     summary: Listar historial de calificaciones
 *     description: Lista todas las calificaciones (trazabilidad de los jurados) en una feria.
 *     tags: [Ratings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID de la elección (Feria o Concurso)
 *       - in: query
 *         name: candidacyId
 *         required: false
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filtrar por proyecto específico
 *     responses:
 *       200:
 *         description: Lista de calificaciones trazables
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 */
