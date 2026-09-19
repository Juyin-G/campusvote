// src/modules/notification/notification.routes.docs.js
// OpenAPI: endpoints del módulo notification.

/**
 * @openapi
 * /api/notifications/unread-count:
 *   get:
 *     summary: Obtener el conteo de notificaciones no leídas
 *     tags: [Notifications]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Conteo
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/UnreadCount' }
 *
 * /api/notifications:
 *   get:
 *     summary: Listar notificaciones del usuario
 *     tags: [Notifications]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
 *       - in: query
 *         name: type
 *         schema: { type: string }
 *       - in: query
 *         name: is_read
 *         schema: { type: boolean }
 *     responses:
 *       200: { description: Lista paginada }
 *
 * /api/notifications/mark-all-read:
 *   post:
 *     summary: Marcar todas las notificaciones como leídas
 *     tags: [Notifications]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Operación exitosa }
 *
 * /api/notifications/{id}:
 *   patch:
 *     summary: Actualizar estado de lectura de una notificación
 *     tags: [Notifications]
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
 *               is_read: { type: boolean }
 *     responses:
 *       200: { description: Notificación actualizada }
 *       404: { description: No encontrada }
 *   delete:
 *     summary: Eliminar notificación
 *     tags: [Notifications]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Notificación eliminada }
 */
