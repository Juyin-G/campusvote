/**
 * @file project.lifecycle.docs.js
 * Endpoints OpenAPI: submit / review del proyecto.
 */

/**
 * @openapi
 * /api/projects/{id}/submit:
 *   post:
 *     tags: [Projects]
 *     summary: Enviar proyecto a revisión (propietario)
 *     description: DRAFT → SUBMITTED.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Proyecto enviado a revisión
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Project' }
 *
 * /api/projects/{id}/review:
 *   post:
 *     tags: [Projects]
 *     summary: Aprobar o rechazar proyecto (ADMIN de la organización dueña)
 *     description: >
 *       ADMIN de la organización aprueba o rechaza. SUPERADMIN NO tiene
 *       acceso operativo (403). La feria no debe estar CLOSED.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [decision]
 *             properties:
 *               decision:
 *                 type: string
 *                 enum: [APPROVED, REJECTED]
 *               review_notes:
 *                 type: string
 *                 maxLength: 2000
 *                 description: Obligatorio cuando decision = REJECTED
 *             additionalProperties: false
 *     responses:
 *       200:
 *         description: Revisión registrada
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Project' }
 *       409: { $ref: '#/components/responses/ConflictResponse' }
 *       403: { $ref: '#/components/responses/ForbiddenResponse' }
 */
