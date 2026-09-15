/**
 * @file fairCategory.docs.js
 * @description Documentación OpenAPI (Swagger) de categorías de ferias
 * académicas (dominio exclusivo de FERIAS; no se mezcla con el catálogo OCDE/
 * CONCYTEC del dominio electoral). Envoltorio: { success, message, data }.
 * @openapi
 * components:
 *   schemas:
 *     FairCategory:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         fair_id:
 *           type: string
 *           format: uuid
 *         name:
 *           type: string
 *         description:
 *           type: string
 *           nullable: true
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 */

/**
 * @openapi
 * /api/fairs/{id}/categories:
 *   get:
 *     tags: [Fair Categories]
 *     summary: Listar categorías de una feria (ADMIN/SUPERADMIN o JURY asignado)
 *     description: >
 *       Lectura compartida en cualquier estado de la feria. El JURY solo accede
 *       si está formalmente asignado a esa feria (si no, 403).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/FairId'
 *     responses:
 *       200:
 *         description: Categorías de la feria
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedResponse'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenResponse'
 *   post:
 *     tags: [Fair Categories]
 *     summary: Crear una categoría (ADMIN/SUPERADMIN, solo en DRAFT)
 *     description: >
 *       Las categorías son por feria (UNIQUE fair_id + name). Solo se gestionan
 *       en estado DRAFT. No hay catálogo global reutilizable.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/FairId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             additionalProperties: false
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 200
 *               description:
 *                 type: string
 *                 maxLength: 5000
 *                 nullable: true
 *     responses:
 *       201:
 *         description: Categoría creada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FairCategory'
 *       409:
 *         $ref: '#/components/responses/ConflictResponse'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedResponse'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenResponse'
 *
 * /api/fairs/{id}/categories/{categoryId}:
 *   put:
 *     tags: [Fair Categories]
 *     summary: Actualizar una categoría (ADMIN/SUPERADMIN, solo en DRAFT)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/FairId'
 *       - in: path
 *         name: categoryId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties: false
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 200
 *               description:
 *                 type: string
 *                 maxLength: 5000
 *                 nullable: true
 *     responses:
 *       200:
 *         description: Categoría actualizada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FairCategory'
 *       404:
 *         $ref: '#/components/responses/NotFoundResponse'
 *       409:
 *         $ref: '#/components/responses/ConflictResponse'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedResponse'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenResponse'
 *   delete:
 *     tags: [Fair Categories]
 *     summary: Eliminar una categoría (ADMIN/SUPERADMIN, solo en DRAFT)
 *     description: >
 *       Se bloquea (409) si la categoría ya tiene proyectos asignados.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/FairId'
 *       - in: path
 *         name: categoryId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Categoría eliminada
 *       404:
 *         $ref: '#/components/responses/NotFoundResponse'
 *       409:
 *         $ref: '#/components/responses/ConflictResponse'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedResponse'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenResponse'
 */