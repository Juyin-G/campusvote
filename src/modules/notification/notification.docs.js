// src/modules/notification/notification.docs.js

/**
 * @swagger
 * tags:
 *   name: Notifications
 *   description: "Gestión de notificaciones del usuario y bandeja de entrada"
 */

/**
 * @swagger
 * /api/notifications/unread-count:
 *   get:
 *     summary: "Obtener conteo de notificaciones no leídas"
 *     description: "Retorna el número de notificaciones pendientes de leer para el usuario autenticado"
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: "Conteo obtenido exitosamente"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Conteo de no leídas obtenido"
 *                 data:
 *                   type: object
 *                   properties:
 *                     unread_count:
 *                       type: integer
 *                       example: 5
 *       401:
 *         description: "No autorizado"
 */

/**
 * @swagger
 * /api/notifications:
 *   get:
 *     summary: "Listar notificaciones del usuario autenticado"
 *     description: "Retorna las notificaciones del usuario con paginación y filtros opcionales"
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: "Número de página"
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 20
 *         description: "Elementos por página"
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum:
 *             - ELECTION_OPENING
 *             - VOTE_CONFIRMATION
 *             - RESULTS_PUBLISHED
 *             - CANDIDACY_APPROVED
 *             - SYSTEM_ALERT
 *         description: "Filtrar por tipo de notificación"
 *       - in: query
 *         name: is_read
 *         schema:
 *           type: string
 *           enum:
 *             - "true"
 *             - "false"
 *         description: "Filtrar por estado de lectura"
 *     responses:
 *       200:
 *         description: "Lista de notificaciones obtenida exitosamente"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Notificaciones obtenidas exitosamente"
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Notification'
 *                 pagination:
 *                   $ref: '#/components/schemas/PaginationMeta'
 *       401:
 *         description: "No autorizado"
 *
 *   post:
 *     summary: "Crear una nueva notificación"
 *     description: "Crea una notificación y programa sus entregas por los canales especificados"
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - user_id
 *               - type
 *               - title
 *               - message
 *             properties:
 *               user_id:
 *                 type: string
 *                 format: uuid
 *                 description: "ID del usuario destinatario"
 *               type:
 *                 type: string
 *                 enum:
 *                   - ELECTION_OPENING
 *                   - VOTE_CONFIRMATION
 *                   - RESULTS_PUBLISHED
 *                   - CANDIDACY_APPROVED
 *                   - SYSTEM_ALERT
 *                 example: "ELECTION_OPENING"
 *               title:
 *                 type: string
 *                 maxLength: 150
 *                 example: "¡La votación ha comenzado!"
 *               message:
 *                 type: string
 *                 example: "La elección ya está abierta"
 *               metadata:
 *                 type: object
 *                 additionalProperties: true
 *               channels:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum:
 *                     - IN_APP
 *                     - EMAIL
 *                     - PUSH
 *                 default:
 *                   - IN_APP
 *     responses:
 *       201:
 *         description: "Notificación creada y entregas programadas"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Notificación creada y entregas programadas"
 *                 data:
 *                   type: object
 *                   properties:
 *                     notification:
 *                       $ref: '#/components/schemas/Notification'
 *                     deliveries_scheduled:
 *                       type: integer
 *                       example: 2
 *       400:
 *         description: "Solicitud inválida"
 *       401:
 *         description: "No autorizado"
 *       403:
 *         description: "Prohibido"
 */

/**
 * @swagger
 * /api/notifications/mark-all-read:
 *   patch:
 *     summary: "Marcar todas las notificaciones como leídas"
 *     description: "Marca todas las notificaciones no leídas del usuario como leídas"
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: "Todas las notificaciones marcadas como leídas"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Todas las notificaciones marcadas como leídas"
 *                 data:
 *                   type: object
 *                   properties:
 *                     success:
 *                       type: boolean
 *                       example: true
 *       401:
 *         description: "No autorizado"
 */

/**
 * @swagger
 * /api/notifications/{id}:
 *   patch:
 *     summary: "Actualizar una notificación específica"
 *     description: "Actualiza el estado de una notificación (ej. marcar como leída)"
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: "ID de la notificación"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               is_read:
 *                 type: boolean
 *                 description: "Estado de lectura"
 *                 example: true
 *     responses:
 *       200:
 *         description: "Notificación actualizada correctamente"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Notificación actualizada correctamente"
 *                 data:
 *                   $ref: '#/components/schemas/Notification'
 *       400:
 *         description: "Solicitud inválida"
 *       401:
 *         description: "No autorizado"
 *       404:
 *         description: "Notificación no encontrada"
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Notification:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         user_id:
 *           type: string
 *           format: uuid
 *         type:
 *           type: string
 *           enum:
 *             - ELECTION_OPENING
 *             - VOTE_CONFIRMATION
 *             - RESULTS_PUBLISHED
 *             - CANDIDACY_APPROVED
 *             - SYSTEM_ALERT
 *         title:
 *           type: string
 *         message:
 *           type: string
 *         metadata:
 *           type: object
 *           additionalProperties: true
 *         is_read:
 *           type: boolean
 *         read_at:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         created_at:
 *           type: string
 *           format: date-time
 */