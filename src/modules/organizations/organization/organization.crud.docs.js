// src/modules/organizations/organization/organization.crud.docs.js
// OpenAPI: /api/organizations (CRUD y onboarding).

/**
 * @openapi
 * /api/organizations:
 *   get:
 *     summary: Listar organizaciones
 *     tags: [Organizations]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 10 }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Buscar por nombre, código o país
 *       - in: query
 *         name: is_active
 *         schema:
 *           type: string
 *           enum: ["true", "false"]
 *     responses:
 *       200: { description: Lista paginada }
 *   post:
 *     summary: Crear organización manualmente
 *     tags: [Organizations]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/CreateOrganizationBody' }
 *     responses:
 *       201: { description: Organización creada }
 *       409: { description: Código duplicado }
 *
 * /api/organizations/{id}:
 *   get:
 *     summary: Obtener organización por ID
 *     tags: [Organizations]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Detalles de la organización }
 *       404: { description: No encontrada }
 *   patch:
 *     summary: Actualizar organización
 *     tags: [Organizations]
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
 *             properties:
 *               name: { type: string, maxLength: 200 }
 *               code: { type: string, maxLength: 30 }
 *               org_type:
 *                 type: string
 *                 enum: [UNIVERSITY, INSTITUTE, SCHOOL, COMPANY, ASSOCIATION, OTHER]
 *               is_active: { type: boolean }
 *               onboarding_completed: { type: boolean }
 *     responses:
 *       200: { description: Organización actualizada }
 *       404: { description: No encontrada }
 *   delete:
 *     summary: Eliminar organización
 *     tags: [Organizations]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Organización eliminada }
 *       404: { description: No encontrada }
 *
 * /api/organizations/{id}/onboarding:
 *   patch:
 *     summary: Actualizar datos de onboarding
 *     tags: [Organizations]
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
 *             properties:
 *               name: { type: string }
 *               logo: { type: string, format: uri }
 *               primary_color: { type: string, pattern: "^#[0-9a-fA-F]{6}$" }
 *               secondary_color: { type: string, pattern: "^#[0-9a-fA-F]{6}$" }
 *               country: { type: string }
 *               timezone: { type: string }
 *     responses:
 *       200: { description: Datos de onboarding actualizados }
 *
 * /api/organizations/{id}/onboarding/complete:
 *   post:
 *     summary: Marcar onboarding como completado
 *     tags: [Organizations]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Onboarding completado }
 *       400: { description: Ya fue completado previamente }
 */
