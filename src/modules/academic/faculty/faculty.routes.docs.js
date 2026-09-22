// src/modules/academic/faculty/faculty.routes.docs.js
// OpenAPI: /api/academic/faculties.

/**
 * @openapi
 * /api/academic/faculties:
 *   get:
 *     summary: Listar facultades
 *     tags: [Academic]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: skip
 *         schema: { type: integer, minimum: 0, default: 0 }
 *       - in: query
 *         name: take
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 50 }
 *     responses:
 *       200: { description: Lista paginada }
 *   post:
 *     summary: Crear facultad
 *     tags: [Academic]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, code]
 *             properties:
 *               name: { type: string }
 *               code: { type: string }
 *     responses:
 *       201: { description: Facultad creada }
 *
 * /api/academic/faculties/{id}:
 *   get:
 *     summary: Obtener facultad por ID
 *     tags: [Academic]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Facultad encontrada }
 *       404: { description: No encontrada }
 *   patch:
 *     summary: Actualizar facultad
 *     tags: [Academic]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Facultad actualizada }
 *   delete:
 *     summary: Eliminar facultad
 *     tags: [Academic]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Facultad eliminada }
 */
