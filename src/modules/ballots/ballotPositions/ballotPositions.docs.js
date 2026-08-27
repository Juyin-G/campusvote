// src/modules/ballots/ballotPositions/ballotPositions.docs.js
// Documentación OpenAPI/Swagger para el submódulo de Posiciones de Boleta (Cargos).

/**
 * @openapi
 * components:
 *   schemas:
 *     BallotPosition:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           example: a1b2c3d4-e5f6-7890-1234-56789abcdef0
 *         ballotId:
 *           type: string
 *           format: uuid
 *         positionId:
 *           type: string
 *           format: uuid
 *         orderIndex:
 *           type: integer
 *           example: 1
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *         position:
 *           type: object
 *           properties:
 *             id:
 *               type: string
 *               format: uuid
 *             electionId:
 *               type: string
 *               format: uuid
 *             name:
 *               type: string
 *               example: Presidencia del Centro de Estudiantes
 *             description:
 *               type: string
 *               nullable: true
 *               example: Cargo ejecutivo principal
 *             maxSelectableOptions:
 *               type: integer
 *               example: 1
 *         options:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/BallotOption'
 */

/**
 * @openapi
 * /api/ballots/{ballotId}/positions:
 *   get:
 *     summary: Listar posiciones de una boleta
 *     description: Retorna todas las posiciones (cargos) configuradas dentro de una boleta específica, ordenadas secuencialmente por orderIndex.
 *     tags: [Ballot Positions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: ballotId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID de la boleta
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
 *                     $ref: '#/components/schemas/BallotPosition'
 *                 meta:
 *                   type: object
 *                   properties:
 *                     requestId:
 *                       type: string
 *                       format: uuid
 *                     total:
 *                       type: integer
 *                       example: 2
 *       401:
 *         description: No autenticado
 *       404:
 *         description: Boleta no encontrada
 *
 *   post:
 *     summary: Agregar posición (cargo) a una boleta
 *     description: Asocia un cargo a la boleta y define su orden de aparición. Si no se especifica orderIndex, se asigna automáticamente al final.
 *     tags: [Ballot Positions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: ballotId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID de la boleta
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - positionId
 *             properties:
 *               positionId:
 *                 type: string
 *                 format: uuid
 *                 description: UUID del cargo a incorporar
 *               orderIndex:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 32767
 *                 example: 1
 *                 description: Posición secuencial en la boleta
 *     responses:
 *       201:
 *         description: Posición agregada a la boleta correctamente
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
 *                   example: Posición agregada a la boleta correctamente
 *                 data:
 *                   $ref: '#/components/schemas/BallotPosition'
 *                 meta:
 *                   type: object
 *                   properties:
 *                     requestId:
 *                       type: string
 *                       format: uuid
 *       400:
 *         description: El cargo no pertenece a la misma elección que la boleta o parámetros inválidos
 *       401:
 *         description: No autenticado
 *       403:
 *         description: Requiere rol ADMIN o ELECTORAL_COMMISSION
 *       404:
 *         description: Boleta o cargo no encontrado
 *       409:
 *         description: El cargo o el orden ya se encuentran asignados a esta boleta
 */

/**
 * @openapi
 * /api/ballots/{ballotId}/positions/{id}:
 *   get:
 *     summary: Obtener una posición de boleta por ID
 *     tags: [Ballot Positions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: ballotId
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
 *         description: UUID de la posición dentro de la boleta
 *     responses:
 *       200:
 *         description: Posición de boleta obtenida correctamente
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
 *                   example: Posición de boleta obtenida correctamente
 *                 data:
 *                   $ref: '#/components/schemas/BallotPosition'
 *                 meta:
 *                   type: object
 *                   properties:
 *                     requestId:
 *                       type: string
 *                       format: uuid
 *       401:
 *         description: No autenticado
 *       404:
 *         description: La posición solicitada no existe en la boleta indicada
 *
 *   put:
 *     summary: Actualizar una posición dentro de la boleta
 *     description: Permite modificar el cargo o reordenar su posición dentro de la boleta.
 *     tags: [Ballot Positions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: ballotId
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
 *         description: UUID de la posición de boleta
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               positionId:
 *                 type: string
 *                 format: uuid
 *               orderIndex:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 32767
 *     responses:
 *       200:
 *         description: Posición de boleta actualizada correctamente
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
 *                   example: Posición de boleta actualizada correctamente
 *                 data:
 *                   $ref: '#/components/schemas/BallotPosition'
 *                 meta:
 *                   type: object
 *                   properties:
 *                     requestId:
 *                       type: string
 *                       format: uuid
 *       400:
 *         description: No se enviaron campos o datos inválidos
 *       401:
 *         description: No autenticado
 *       403:
 *         description: Requiere rol ADMIN o ELECTORAL_COMMISSION
 *       404:
 *         description: Posición no encontrada en esta boleta
 *       409:
 *         description: Conflicto por cargo duplicado o índice de orden en uso
 *
 *   delete:
 *     summary: Eliminar una posición de la boleta
 *     tags: [Ballot Positions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: ballotId
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
 *         description: Posición eliminada de la boleta correctamente
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
 *                   example: Posición eliminada de la boleta correctamente
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
 *         description: No autenticado
 *       403:
 *         description: Requiere rol ADMIN o ELECTORAL_COMMISSION
 *       404:
 *         description: Posición no encontrada en la boleta especificada
 */