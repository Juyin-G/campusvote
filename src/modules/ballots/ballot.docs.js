// src/modules/ballots/ballot.docs.js
// Documentación OpenAPI/Swagger del módulo Ballots.

/**
 * @openapi
 * components:
 *   schemas:
 *     Ballot:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           example: f47ac10b-58cc-4372-a567-0e02b2c3d479
 *         electionId:
 *           type: string
 *           format: uuid
 *           example: e28bc10b-58cc-4372-a567-0e02b2c3d111
 *         version:
 *           type: integer
 *           minimum: 1
 *           example: 1
 *         isActive:
 *           type: boolean
 *           example: true
 *         generatedAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *         positions:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/BallotPosition'
 *
 *     BallotCompleteness:
 *       type: object
 *       properties:
 *         isComplete:
 *           type: boolean
 *           example: true
 *         totalPositions:
 *           type: integer
 *           example: 3
 *         positionsWithOption:
 *           type: integer
 *           example: 3
 *         missingPositionIds:
 *           type: array
 *           items:
 *             type: string
 *             format: uuid
 *           example: []
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
 *         name: electionId
 *         required: false
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
 *         description: Consulta exitosa
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
 *                   example: Consulta exitosa
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Ballot'
 *                 meta:
 *                   type: object
 *                   properties:
 *                     requestId:
 *                       type: string
 *                       format: uuid
 *                     total:
 *                       type: integer
 *                       example: 1
 *                     page:
 *                       type: integer
 *                       example: 1
 *                     limit:
 *                       type: integer
 *                       example: 10
 *       400:
 *         description: Parámetros de búsqueda inválidos
 *       401:
 *         description: No autenticado
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
 *               - electionId
 *             properties:
 *               electionId:
 *                 type: string
 *                 format: uuid
 *               version:
 *                 type: integer
 *                 minimum: 1
 *               isActive:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Boleta creada correctamente
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
 *                   example: Boleta creada correctamente
 *                 data:
 *                   $ref: '#/components/schemas/Ballot'
 *                 meta:
 *                   type: object
 *                   properties:
 *                     requestId:
 *                       type: string
 *                       format: uuid
 *       400:
 *         description: Error de validación o elección bloqueada
 *       401:
 *         description: No autenticado
 *       403:
 *         description: requiere rol ADMIN
 */

/**
 * @openapi
 * /api/ballots/{id}:
 *   get:
 *     summary: Obtener una boleta por ID
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
 *         description: Boleta obtenida correctamente
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
 *                   example: Boleta obtenida correctamente
 *                 data:
 *                   $ref: '#/components/schemas/Ballot'
 *                 meta:
 *                   type: object
 *                   properties:
 *                     requestId:
 *                       type: string
 *                       format: uuid
 *       401:
 *         description: No autenticado
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               version:
 *                 type: integer
 *                 minimum: 1
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Boleta actualizada correctamente
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
 *                   example: Boleta actualizada correctamente
 *                 data:
 *                   $ref: '#/components/schemas/Ballot'
 *                 meta:
 *                   type: object
 *                   properties:
 *                     requestId:
 *                       type: string
 *                       format: uuid
 *       400:
 *         description: Datos inválidos o elección bloqueada
 *       401:
 *         description: No autenticado
 *       403:
 *         description: requiere rol ADMIN
 *       404:
 *         description: Boleta no encontrada
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
 *         description: Boleta eliminada correctamente
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
 *                   example: Boleta eliminada correctamente
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
 *       400:
 *         description: No se puede eliminar por estado de la elección
 *       401:
 *         description: No autenticado
 *       403:
 *         description: requiere rol ADMIN
 *       404:
 *         description: Boleta no encontrada
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
 *         description: Boleta activa obtenida correctamente
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
 *                   example: Boleta activa obtenida correctamente
 *                 data:
 *                   $ref: '#/components/schemas/Ballot'
 *                 meta:
 *                   type: object
 *                   properties:
 *                     requestId:
 *                       type: string
 *                       format: uuid
 *       401:
 *         description: No autenticado
 *       404:
 *         description: No existe boleta activa para esta elección
 */

/**
 * @openapi
 * /api/ballots/election/{electionId}/version:
 *   post:
 *     summary: Crear una nueva versión de la boleta
 *     description: Desactiva la versión previa y crea una nueva activa incrementando la versión.
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
 *         description: Nueva versión generada correctamente
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
 *                   example: Nueva versión generada correctamente
 *                 data:
 *                   $ref: '#/components/schemas/Ballot'
 *                 meta:
 *                   type: object
 *                   properties:
 *                     requestId:
 *                       type: string
 *                       format: uuid
 *       400:
 *         description: La elección no permite nuevas versiones
 *       401:
 *         description: No autenticado
 *       403:
 *         description: requiere rol ADMIN
 *       404:
 *         description: Elección no encontrada
 */

/**
 * @openapi
 * /api/ballots/{id}/completeness:
 *   get:
 *     summary: Validar integridad de una boleta
 *     description: Verifica que cada posición asignada tenga al menos una opción válida.
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
 *         description: Validación realizada exitosamente
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
 *                   example: Validación de integridad realizada
 *                 data:
 *                   $ref: '#/components/schemas/BallotCompleteness'
 *                 meta:
 *                   type: object
 *                   properties:
 *                     requestId:
 *                       type: string
 *                       format: uuid
 *       401:
 *         description: No autenticado
 *       404:
 *         description: Boleta no encontrada
 */