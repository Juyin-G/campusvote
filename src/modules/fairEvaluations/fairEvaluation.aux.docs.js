/**
 * @file fairEvaluation.aux.docs.js
 * Documentación OpenAPI (Swagger) — declaración de jurado, progreso y
 * endpoints auxiliares de ferias (proyectos evaluables, detalle).
 */

/**
 * @openapi
 * /api/fairs/{id}/jury/declaration:
 *   post:
 *     tags: [FairJuryDeclaration]
 *     summary: Firmar declaración de imparcialidad (JURY)
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
 *             required: [statement]
 *             properties:
 *               statement: { type: string, maxLength: 2000 }
 *     responses:
 *       201: { description: Declaración firmada }
 *       409: { description: Ya has firmado la declaración }
 *   get:
 *     tags: [FairJuryDeclaration]
 *     summary: Consultar declaración (JURY asignado)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Declaración (signed: bool) }
 *
 * /api/fairs/my-progress/{fairId}:
 *   get:
 *     tags: [FairProgress]
 *     summary: Avance del JURY en la feria (rúbrica completada vs. pendiente)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: fairId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: |
 *           { fair_id, fair_name, fair_status, declaration,
 *             total_projects, completed_projects, pending_projects,
 *             progress_percentage, has_voted }
 *
 * /api/fairs/my-evaluations:
 *   get:
 *     tags: [FairRubricChecklist]
 *     summary: Mis hojas de rúbrica CHECKLIST (JURY)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: fair_id
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
 *     responses:
 *       200: { description: Lista paginada de mis hojas }
 *
 * /api/fairs/{id}/evaluations:
 *   get:
 *     tags: [FairRubricChecklist]
 *     summary: Hojas de la feria (ADMIN todas; JURY solo las suyas)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: project_id
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: jury_user_id
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Lista paginada }
 *
 * /api/fairs/{id}/projects:
 *   get:
 *     tags: [FairProjects]
 *     summary: Proyectos APPROVED evaluables de la feria
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Lista paginada }
 *
 * /api/fairs/{id}/projects/{projectId}:
 *   get:
 *     tags: [FairProjects]
 *     summary: Detalle de un proyecto APPROVED (JURY asignado / ADMIN)
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
 *       200: { description: Detalle con logo/cover/url/miembros }
 */
