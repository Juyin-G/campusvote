/**
 * @file program.docs.js
 * @description Documentación OpenAPI para los endpoints de Programas Académicos
 * @module modules/academic/program
 */

/**
 * @openapi
 * components:
 *   schemas:
 *     Program:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           example: "b1f8d2e4-9a3c-4d5e-8f12-3a4b5c6d7e8f"
 *         faculty_id:
 *           type: string
 *           format: uuid
 *           example: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
 *         name:
 *           type: string
 *           example: "Ingeniería de Sistemas"
 *         code:
 *           type: string
 *           example: "IS"
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 *
 *     CreateProgramRequest:
 *       type: object
 *       required:
 *         - faculty_id
 *         - name
 *         - code
 *       properties:
 *         faculty_id:
 *           type: string
 *           format: uuid
 *           example: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
 *         name:
 *           type: string
 *           minLength: 3
 *           maxLength: 150
 *           example: "Ingeniería de Sistemas"
 *         code:
 *           type: string
 *           minLength: 2
 *           maxLength: 20
 *           example: "IS"
 *
 *     UpdateProgramRequest:
 *       type: object
 *       properties:
 *         faculty_id:
 *           type: string
 *           format: uuid
 *           example: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
 *         name:
 *           type: string
 *           minLength: 3
 *           maxLength: 150
 *           example: "Ingeniería del Software"
 *         code:
 *           type: string
 *           minLength: 2
 *           maxLength: 20
 *           example: "ISOFT"
 */

/**
 * @openapi
 * /api/academic/programs:
 *   get:
 *     summary: Obtener lista de programas académicos (paginada)
 *     tags: [Academic]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: faculty_id
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filtrar programas por ID de facultad (opcional)
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
 *     responses:
 *       200:
 *         description: Lista de programas obtenida exitosamente
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
 *                         $ref: '#/components/schemas/Program'
 *                     meta:
 *                       $ref: '#/components/schemas/PaginationMeta'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedResponse'
 *       403:
 *         $ref: '#/components/responses/ForbiddenResponse'
 *
 *   post:
 *     summary: Crear un nuevo programa académico
 *     description: >
 *       Crea un programa asociado a una facultad. 
 *       El código debe ser único a nivel global y el nombre único dentro de la misma facultad.
 *     tags: [Academic]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateProgramRequest'
 *     responses:
 *       201:
 *         description: Programa creado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/responses/CreatedResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Program'
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
 * /api/academic/programs/{id}:
 *   get:
 *     summary: Obtener un programa académico por su ID
 *     tags: [Academic]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID del programa académico
 *     responses:
 *       200:
 *         description: Programa encontrado
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/responses/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Program'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedResponse'
 *       403:
 *         $ref: '#/components/responses/ForbiddenResponse'
 *       404:
 *         $ref: '#/components/responses/NotFoundResponse'
 *
 *   put:
 *     summary: Actualizar un programa académico
 *     tags: [Academic]
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
 *             $ref: '#/components/schemas/UpdateProgramRequest'
 *     responses:
 *       200:
 *         description: Programa actualizado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/responses/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Program'
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
 *     summary: Eliminar un programa académico
 *     description: >
 *       No se puede eliminar si tiene registros asociados (ej. padrón electoral) 
 *       debido a la restricción ON DELETE RESTRICT de la base de datos.
 *     tags: [Academic]
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
 *         description: Programa eliminado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/responses/SuccessResponse'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedResponse'
 *       403:
 *         $ref: '#/components/responses/ForbiddenResponse'
 *       404:
 *         $ref: '#/components/responses/NotFoundResponse'
 *       409:
 *         $ref: '#/components/responses/ConflictResponse'
 */