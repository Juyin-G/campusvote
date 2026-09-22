/**
 * @file fairEvaluation.rubric.docs.js
 * Documentación OpenAPI (Swagger) — rúbrica CHECKLIST y criterios.
 * @openapi
 * components:
 *   schemas:
 *     FairRubricCriterion:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         name: { type: string }
 *         description: { type: string, nullable: true }
 *         position: { type: integer }
 *         is_active: { type: boolean }
 *     FairRubric:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         fair_id: { type: string, format: uuid }
 *         name: { type: string }
 *         description: { type: string, nullable: true }
 *         criteria:
 *           type: array
 *           items: { $ref: '#/components/schemas/FairRubricCriterion' }
 *     FairRubricChecklistResponse:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         fair_id: { type: string, format: uuid }
 *         project_id: { type: string, format: uuid }
 *         rubric_id: { type: string, format: uuid }
 *         submitted: { type: boolean }
 *         submitted_at: { type: string, format: date-time, nullable: true }
 *         responses:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               id: { type: string, format: uuid }
 *               criterion_id: { type: string, format: uuid }
 *               criterion_name: { type: string }
 *               criterion_position: { type: integer }
 *               checked: { type: boolean }
 */

/**
 * @openapi
 * /api/fairs/{id}/rubric:
 *   get:
 *     tags: [FairRubric]
 *     summary: Obtener la rúbrica CHECKLIST de una feria (ADMIN o JURY asignado)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Rúbrica con sus criterios
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/FairRubric' }
 *   post:
 *     tags: [FairRubric]
 *     summary: Crear la rúbrica de la feria (ADMIN)
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
 *             required: [name]
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *     responses:
 *       201: { description: Rúbrica creada }
 *   put:
 *     tags: [FairRubric]
 *     summary: Actualizar la rúbrica (ADMIN, solo DRAFT)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Rúbrica actualizada }
 *
 * /api/fairs/{id}/rubric/criteria:
 *   post:
 *     tags: [FairRubric]
 *     summary: Agregar criterio a la rúbrica (ADMIN)
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
 *             required: [name]
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *               position: { type: integer, minimum: 1 }
 *     responses:
 *       201: { description: Criterio creado }
 *
 * /api/fairs/{id}/rubric/criteria/{criterionId}:
 *   put:
 *     tags: [FairRubric]
 *     summary: Editar criterio (ADMIN, incluye is_active)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: criterionId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *               position: { type: integer, minimum: 1 }
 *               is_active: { type: boolean }
 *     responses:
 *       200: { description: Criterio actualizado }
 *   delete:
 *     tags: [FairRubric]
 *     summary: Eliminar criterio (ADMIN, solo DRAFT)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: criterionId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Criterio eliminado }
 *
 * /api/fairs/{id}/projects/{projectId}/rubric:
 *   get:
 *     tags: [FairRubricChecklist]
 *     summary: Obtener mi hoja de respuestas CHECKLIST (JURY asignado)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Hoja con responses[] y submitted
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/FairRubricChecklistResponse' }
 *   put:
 *     tags: [FairRubricChecklist]
 *     summary: Guardar/finalizar respuestas CHECKLIST (JURY asignado)
 *     description: >
 *       El payload `responses` debe cubrir TODOS los criterios ACTIVOS de la
 *       rúbrica. `finalize=true` marca la hoja como finalizada (inmutable).
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [responses]
 *             properties:
 *               responses:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required: [criterion_id, checked]
 *                   properties:
 *                     criterion_id: { type: string, format: uuid }
 *                     checked: { type: boolean }
 *               finalize: { type: boolean, default: false }
 *     responses:
 *       200:
 *         description: Hoja guardada (o finalizada)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/FairRubricChecklistResponse' }
 *       400: { description: Faltan criterios activos por responder }
 *       409: { description: Rúbrica ya finalizada }
 */
