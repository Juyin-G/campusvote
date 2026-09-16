// src/modules/ballots/ballotOptions/ballotOptions.docs.js
// Documentación OpenAPI/Swagger para el submódulo de Opciones de Boleta.

/**
 * @openapi
 * components:
 *   schemas:
 *     BallotOptionType:
 *       type: string
 *       enum: [CANDIDATE_LIST, BLANK, VOID]
 *       example: CANDIDATE_LIST
 *
 *     BallotOption:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           example: c7f8a2b1-1234-5678-90ab-cdef12345678
 *         ballotPositionId:
 *           type: string
 *           format: uuid
 *         candidateListId:
 *           type: string
 *           format: uuid
 *           nullable: true
 *         optionType:
 *           $ref: '#/components/schemas/BallotOptionType'
 *         label:
 *           type: string
 *           example: Lista 1 - Unidad Estudiantil
 *         orderIndex:
 *           type: integer
 *           example: 1
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

/**
 * @openapi
 * /api/ballots/{ballotId}/positions/{ballotPositionId}/options:
 *   get:
 *     summary: Listar opciones de una posición de boleta
 *     description: Retorna todas las opciones configuradas para una posición específica de la boleta.
 *     tags: [Ballot Options]
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
 *       - in: path
 *         name: ballotPositionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID de la posición dentro de la boleta
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
 *                     $ref: '#/components/schemas/BallotOption'
 *                 meta:
 *                   type: object
 *                   properties:
 *                     requestId:
 *                       type: string
 *                       format: uuid
 *                     total:
 *                       type: integer
 *                       example: 3
 *       401:
 *         description: No autenticado
 *       404:
 *         description: Posición de boleta no encontrada
 *
 *   post:
 *     summary: Crear opción de boleta
 *     description: Agrega una opción (Lista candidata, Voto en blanco o Voto nulo) a la posición de boleta.
 *     tags: [Ballot Options]
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
 *         name: ballotPositionId
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
 *             required:
 *               - optionType
 *             properties:
 *               optionType:
 *                 $ref: '#/components/schemas/BallotOptionType'
 *               candidateListId:
 *                 type: string
 *                 format: uuid
 *                 nullable: true
 *                 description: Obligatorio cuando optionType es CANDIDATE_LIST
 *               label:
 *                 type: string
 *                 maxLength: 120
 *                 example: Lista 1 - Unidad Estudiantil
 *               orderIndex:
 *                 type: integer
 *                 minimum: 1
 *                 default: 1
 *     responses:
 *       201:
 *         description: Opción agregada a la boleta correctamente
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
 *                   example: Opción agregada a la boleta correctamente
 *                 data:
 *                   $ref: '#/components/schemas/BallotOption'
 *                 meta:
 *                   type: object
 *                   properties:
 *                     requestId:
 *                       type: string
 *                       format: uuid
 *       400:
 *         description: Error de validación en parámetros o incoherencia entre el tipo de opción y candidateListId
 *       401:
 *         description: No autenticado
 *       403:
 *         description: requiere rol ADMIN
 *       404:
 *         description: Posición de boleta o lista candidata no encontrada
 *       409:
 *         description: La lista candidata o la opción especial (BLANK/VOID) ya existe en la posición
 */

/**
 * @openapi
 * /api/ballots/{ballotId}/positions/{ballotPositionId}/options/{id}:
 *   get:
 *     summary: Obtener una opción de boleta por ID
 *     tags: [Ballot Options]
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
 *         name: ballotPositionId
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
 *         description: UUID de la opción de boleta
 *     responses:
 *       200:
 *         description: Opción de boleta obtenida correctamente
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
 *                   example: Opción de boleta obtenida correctamente
 *                 data:
 *                   $ref: '#/components/schemas/BallotOption'
 *                 meta:
 *                   type: object
 *                   properties:
 *                     requestId:
 *                       type: string
 *                       format: uuid
 *       401:
 *         description: No autenticado
 *       404:
 *         description: La opción no existe o no pertenece a la posición indicada
 *
 *   put:
 *     summary: Actualizar una opción de boleta
 *     tags: [Ballot Options]
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
 *         name: ballotPositionId
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
 *         description: UUID de la opción de boleta
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               optionType:
 *                 $ref: '#/components/schemas/BallotOptionType'
 *               candidateListId:
 *                 type: string
 *                 format: uuid
 *                 nullable: true
 *               label:
 *                 type: string
 *                 maxLength: 120
 *               orderIndex:
 *                 type: integer
 *                 minimum: 1
 *     responses:
 *       200:
 *         description: Opción de boleta actualizada correctamente
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
 *                   example: Opción de boleta actualizada correctamente
 *                 data:
 *                   $ref: '#/components/schemas/BallotOption'
 *                 meta:
 *                   type: object
 *                   properties:
 *                     requestId:
 *                       type: string
 *                       format: uuid
 *       400:
 *         description: No se enviaron campos para actualizar o datos inválidos
 *       401:
 *         description: No autenticado
 *       403:
 *         description: requiere rol ADMIN
 *       404:
 *         description: La opción no existe o no pertenece a la posición
 *       409:
 *         description: Conflicto por duplicidad de lista candidata o tipo especial
 *
 *   delete:
 *     summary: Eliminar una opción de boleta
 *     tags: [Ballot Options]
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
 *         name: ballotPositionId
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
 *         description: Opción eliminada de la boleta correctamente
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
 *                   example: Opción eliminada de la boleta correctamente
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
 *         description: requiere rol ADMIN
 *       404:
 *         description: Opción no encontrada en la posición indicada
 */