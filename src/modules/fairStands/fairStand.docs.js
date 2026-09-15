/**
 * @file fairStand.docs.js
 * @description Documentación OpenAPI (Swagger) de stands/cabinas de ferias
 * académicas (dominio exclusivo de FERIAS). Envoltorio: { success, message, data }.
 * @openapi
 * components:
 *   schemas:
 *     FairStand:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         fair_id:
 *           type: string
 *           format: uuid
 *         code:
 *           type: string
 *           description: Identificador corto del stand (p. ej. 'A-01'), único en la feria
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
 * /api/fairs/{id}/stands:
 *   get:
 *     tags: [Fair Stands]
 *     summary: Listar stands de una feria (ADMIN/SUPERADMIN o JURY asignado)
 *     description: >
 *       Lectura compartida en cualquier estado de la feria. El JURY solo accede
 *       si está formalmente asignado a esa feria (si no, 403).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/FairId'
 *     responses:
 *       200:
 *         description: Stands de la feria
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedResponse'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenResponse'
 *   post:
 *     tags: [Fair Stands]
 *     summary: Crear un stand (ADMIN/SUPERADMIN, solo en DRAFT)
 *     description: >
 *       El código es único dentro de la feria (UNIQUE fair_id + code). Solo se
 *       gestionan en estado DRAFT.
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
 *             required: [code]
 *             additionalProperties: false
 *             properties:
 *               code:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 100
 *               description:
 *                 type: string
 *                 maxLength: 5000
 *                 nullable: true
 *     responses:
 *       201:
 *         description: Stand creado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FairStand'
 *       409:
 *         $ref: '#/components/responses/ConflictResponse'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedResponse'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenResponse'
 *
 * /api/fairs/{id}/stands/{standId}:
 *   put:
 *     tags: [Fair Stands]
 *     summary: Actualizar un stand (ADMIN/SUPERADMIN, solo en DRAFT)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/FairId'
 *       - in: path
 *         name: standId
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
 *               code:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 100
 *               description:
 *                 type: string
 *                 maxLength: 5000
 *                 nullable: true
 *     responses:
 *       200:
 *         description: Stand actualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FairStand'
 *       404:
 *         $ref: '#/components/responses/NotFoundResponse'
 *       409:
 *         $ref: '#/components/responses/ConflictResponse'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedResponse'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenResponse'
 *   delete:
 *     tags: [Fair Stands]
 *     summary: Eliminar un stand (ADMIN/SUPERADMIN, solo en DRAFT)
 *     description: >
 *       Se bloquea (409) si el stand tiene un proyecto asignado (1 stand = 1
 *       proyecto).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/FairId'
 *       - in: path
 *         name: standId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Stand eliminado
 *       404:
 *         $ref: '#/components/responses/NotFoundResponse'
 *       409:
 *         $ref: '#/components/responses/ConflictResponse'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedResponse'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenResponse'
 */