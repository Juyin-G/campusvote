// src/modules/notification/notification.schemas.docs.js
// OpenAPI: schemas del módulo notification.

/**
 * @openapi
 * components:
 *   schemas:
 *     Notification:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         user_id: { type: string, format: uuid }
 *         type: { type: string }
 *         title: { type: string }
 *         message: { type: string }
 *         metadata: { type: object }
 *         read_at: { type: string, format: date-time, nullable: true }
 *         created_at: { type: string, format: date-time }
 *
 *     NotificationList:
 *       type: object
 *       properties:
 *         notifications:
 *           type: array
 *           items: { $ref: '#/components/schemas/Notification' }
 *         pagination:
 *           type: object
 *           properties:
 *             page: { type: integer }
 *             limit: { type: integer }
 *             total: { type: integer }
 *
 *     UnreadCount:
 *       type: object
 *       properties:
 *         unread: { type: integer }
 */
