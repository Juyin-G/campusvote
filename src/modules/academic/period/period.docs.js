// src/modules/academic/period/period.docs.js


/**
 * @file period.docs.js
 * @description Documentación OpenAPI para los endpoints de Periodos Académicos
 * @module modules/academic/period
 */

/**
 * @openapi
 * tags:
 *   name: Academic
 *   description: Gestión de facultades, programas y periodos académicos
 */

/**
 * @openapi
 * /api/academic/periods:
 *   get:
 *     summary: Obtener lista de periodos académicos (paginada)
 *     tags: [Academic]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: skip
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Cantidad de registros a saltar
 *       - in: query
 *         name: take
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Cantidad de registros a obtener
 *       - in: query
 *         name: is_active
 *         schema:
 *           type: boolean
 *         description: Filtrar solo periodos activos o inactivos (opcional)
 *     responses:
 *       200:
 *         description: Lista de periodos obtenida exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/responses/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/AcademicPeriod'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedResponse'
 *       403:
 *         $ref: '#/components/responses/ForbiddenResponse'
 *
 *   post:
 *     summary: Crear un nuevo periodo académico
 *     tags: [Academic]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreatePeriodRequest'
 *     responses:
 *       201:
 *         description: Periodo creado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/responses/CreatedResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/AcademicPeriod'
 *       400:
 *         $ref: '#/components/responses/BadRequestResponse'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedResponse'
 *       403:
 *         $ref: '#/components/responses/ForbiddenResponse'
 *       409:
 *         $ref: '#/components/responses/ConflictResponse'
 *
 * /api/academic/periods/{id}:
 *   get:
 *     summary: Obtener un periodo académico por su ID
 *     tags: [Academic]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           $ref: '#/components/schemas/UUID'
 *         description: ID del periodo académico
 *     responses:
 *       200:
 *         description: Periodo encontrado
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/responses/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/AcademicPeriod'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedResponse'
 *       403:
 *         $ref: '#/components/responses/ForbiddenResponse'
 *       404:
 *         $ref: '#/components/responses/NotFoundResponse'
 *
 *   put:
 *     summary: Actualizar un periodo académico
 *     tags: [Academic]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           $ref: '#/components/schemas/UUID'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdatePeriodRequest'
 *     responses:
 *       200:
 *         description: Periodo actualizado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/responses/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/AcademicPeriod'
 *       400:
 *         $ref: '#/components/responses/BadRequestResponse'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedResponse'
 *       403:
 *         $ref: '#/components/responses/ForbiddenResponse'
 *       404:
 *         $ref: '#/components/responses/NotFoundResponse'
 *       409:
 *         $ref: '#/components/responses/ConflictResponse'
 *
 *   delete:
 *     summary: Eliminar un periodo académico
 *     tags: [Academic]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           $ref: '#/components/schemas/UUID'
 *     responses:
 *       204:
 *         $ref: '#/components/responses/NoContentResponse'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedResponse'
 *       403:
 *         $ref: '#/components/responses/ForbiddenResponse'
 *       404:
 *         $ref: '#/components/responses/NotFoundResponse'
 *       409:
 *         description: Conflicto - El periodo tiene registros asociados (ej. padrón electoral)
 *         $ref: '#/components/responses/ConflictResponse'
 *
 * /api/academic/periods/{id}/active:
 *   patch:
 *     summary: Marcar un periodo académico como activo
 *     description: >
 *       Esta operación desactiva automáticamente cualquier otro periodo que esté 
 *       actualmente marcado como activo, garantizando que solo haya uno a la vez.
 *     tags: [Academic]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           $ref: '#/components/schemas/UUID'
 *         description: ID del periodo a activar
 *     responses:
 *       200:
 *         description: Periodo marcado como activo exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/responses/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/AcademicPeriod'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedResponse'
 *       403:
 *         $ref: '#/components/responses/ForbiddenResponse'
 *       404:
 *         $ref: '#/components/responses/NotFoundResponse'
 */