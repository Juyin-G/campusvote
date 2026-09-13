// src/modules/notification/notification.routes.js

import { Router } from 'express';
import * as notificationController from './notification.controller.js';
import { authenticate, authorize } from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { ROLES } from '../../constants/roles.js';
import {
  createNotificationSchema,
  updateNotificationSchema,
} from './notification.schema.js';

const router = Router();

// Solo gestores pueden crear notificaciones (no existe un rol SYSTEM en el enum)
const NOTIFICATION_CREATORS = [ROLES.ADMIN, ROLES.ELECTORAL_COMMISSION];



router.get(
  '/unread-count',
  authenticate,
  notificationController.getUnreadCount
);

// Listar notificaciones con paginación y filtros
router.get(
  '/',
  authenticate,
  notificationController.listNotifications
);



// Crear notificación (Restringido a Admin/Sistema)
router.post(
  '/',
  authenticate,
  authorize(NOTIFICATION_CREATORS),
  validate(createNotificationSchema),
  notificationController.createNotification
);

// Marcar todas como leídas (Acción del usuario sobre sus propios datos)
router.patch(
  '/mark-all-read',
  authenticate,
  notificationController.markAllAsRead
);

// Actualizar una notificación específica (ej. marcar una como leída)
// El servicio valida internamente que el userId coincida con el propietario
router.patch(
  '/:id',
  authenticate,
  validate(updateNotificationSchema),
  notificationController.updateNotification
);

export default router;