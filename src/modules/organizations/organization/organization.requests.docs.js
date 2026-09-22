// src/modules/organizations/organization/organization.requests.docs.js
// OpenAPI: /api/organizations/requests (lista + creación + get + reject).

/**
 * @openapi
 * /api/organizations/requests:
 *   get:
 *     summary: Listar solicitudes de organización
 *     tags: [Organization Requests]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 10 }
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, APPROVED, REJECTED]
 *     responses:
 *       200: { description: Lista paginada }
 *   post:
 *     summary: Crear solicitud de organización (público)
 *     tags: [Organization Requests]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/CreateOrganizationRequest' }
 *     responses:
 *       201: { description: Solicitud creada }
 *
 * /api/organizations/requests/{id}:
 *   get:
 *     summary: Obtener una solicitud por ID
 *     tags: [Organization Requests]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Solicitud encontrada }
 *       404: { description: No encontrada }
 *
 * /api/organizations/requests/{id}/reject:
 *   post:
 *     summary: Rechazar una solicitud
 *     tags: [Organization Requests]
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
 *               reason: { type: string }
 *     responses:
 *       200: { description: Solicitud rechazada }
 */
