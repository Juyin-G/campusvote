// src/modules/notification/notification.controller.js
// S5-04 — Capa HTTP: recibe request, delega a notification.service, responde JSON.

import * as notificationService from './notification.service.js';
import asyncHandler from '../../shared/utils/asyncHandler.js';
import { sendSuccess, sendPaginated } from '../../shared/utils/apiResponse.js';
import { HTTP_STATUS } from '../../constants/httpStatus.js';

// Helper para obtener el ID del usuario autenticado de forma segura
const getUserId = (req) => req.user?.id || req.user?.userId;

/**
 * Obtener conteo de notificaciones no leídas
 * @route GET /api/notifications/unread-count
 * @access Autenticado
 */
export const getUnreadCount = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  const result = await notificationService.getUnreadCount(userId);

  return sendSuccess(
    res,
    result,
    'Conteo de no leídas obtenido',
    { requestId: req.requestId },
    HTTP_STATUS.OK
  );
});

/**
 * Listar notificaciones del usuario autenticado
 * @route GET /api/notifications
 * @access Autenticado
 */
export const listNotifications = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  const { notifications, pagination } = await notificationService.listNotifications(
    userId,
    req.query
  );

  return sendPaginated(
    res,
    notifications,
    pagination,
    'Notificaciones obtenidas exitosamente',
    { requestId: req.requestId }
  );
});

/**
 * Crear una nueva notificación y programar sus entregas
 * @route POST /api/notifications
 * @access ADMIN, SYSTEM
 */
export const createNotification = asyncHandler(async (req, res) => {
  const result = await notificationService.createNotification(req.body);

  return sendSuccess(
    res,
    result,
    'Notificación creada y entregas programadas',
    { requestId: req.requestId },
    HTTP_STATUS.CREATED
  );
});

/**
 * Actualizar una notificación (ej. marcar como leída)
 * @route PATCH /api/notifications/:id
 * @access Autenticado (Solo el propietario)
 */
export const updateNotification = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  const updated = await notificationService.updateNotification(
    req.params.id,
    userId,
    req.body
  );

  return sendSuccess(
    res,
    updated,
    'Notificación actualizada correctamente',
    { requestId: req.requestId },
    HTTP_STATUS.OK
  );
});

/**
 * Marcar TODAS las notificaciones del usuario como leídas
 * @route PATCH /api/notifications/mark-all-read
 * @access Autenticado
 */
export const markAllAsRead = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  const result = await notificationService.markAllAsRead(userId);

  return sendSuccess(
    res,
    result,
    'Todas las notificaciones marcadas como leídas',
    { requestId: req.requestId },
    HTTP_STATUS.OK
  );
});

export default {
  getUnreadCount,
  listNotifications,
  createNotification,
  updateNotification,
  markAllAsRead,
};