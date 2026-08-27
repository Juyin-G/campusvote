// src/modules/notification/notification.service.js

import * as notificationRepository from './notification.repository.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import MESSAGES from '../../constants/messages.js';

const translatePrismaError = (err) => {
  if (err?.code === 'P2025') {
    return ApiError.notFound('La notificación o registro de entrega no existe');
  }
  if (err?.code === 'P2003') {
    return ApiError.badRequest('El usuario destinatario no existe');
  }
  return err;
};

/**
 * Formatea la respuesta de Prisma (camelCase) a formato API (snake_case)
 */
const formatNotification = (notification) => {
  if (!notification) return null;
  return {
    id: notification.id,
    user_id: notification.userId,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    metadata: notification.metadata,
    is_read: notification.readAt !== null, 
    read_at: notification.readAt,
    created_at: notification.createdAt,
  };
};

/**
 * Obtiene el conteo de notificaciones no leídas del usuario.
 */
export const getUnreadCount = async (userId) => {
  const count = await notificationRepository.countUnreadNotifications(userId);
  return { unread_count: count };
};

/**
 * Lista las notificaciones del usuario autenticado.
 */
export const listNotifications = async (userId, query) => {
  const { page, limit, type, is_read } = query;
  
  const [total, notifications] = await Promise.all([
    notificationRepository.countUnreadNotifications(userId), // Opcional: contar total con filtros si se necesita paginación real
    notificationRepository.findNotificationsByUser(userId, { page, limit, type, isRead: is_read }),
  ]);

  return {
    notifications: notifications.map(formatNotification),
    pagination: {
      page,
      limit,
      total, // Simplificado: en producción real, harías un count() con los mismos filtros
    },
  };
};

/**
 * Crea una notificación y programa sus entregas (Transaccional).
 */
export const createNotification = async (body) => {
  const notificationData = {
    userId: body.user_id,
    type: body.type,
    title: body.title.trim(),
    message: body.message.trim(),
    metadata: body.metadata || {},
  };

  try {
    const result = await notificationRepository.createNotificationWithDeliveries(
      notificationData,
      body.channels
    );
    
    return {
      notification: formatNotification(result.notification),
      deliveries_scheduled: result.deliveries.length,
    };
  } catch (err) {
    throw translatePrismaError(err);
  }
};

/**
 * Actualiza el estado de lectura de una notificación.
 * (Valida que la notificación pertenezca al usuario que hace la petición).
 */
export const updateNotification = async (id, userId, body) => {
  try {
    if (body.is_read !== undefined) {
      const updated = await notificationRepository.updateNotificationReadStatus(
        id,
        userId,
        body.is_read
      );
      return formatNotification(updated);
    }
    
    // Si en el futuro se permite actualizar metadata:
    // return formatNotification(await notificationRepository.updateMetadata(id, userId, body.metadata));
    
    throw ApiError.badRequest('No se proporcionaron campos válidos para actualizar');
  } catch (err) {
    if (err?.code === 'P2025') {
      throw ApiError.notFound('No tienes permiso para modificar esta notificación o no existe');
    }
    throw err;
  }
};

/**
 * Marca TODAS las notificaciones de un usuario como leídas.
 */
export const markAllAsRead = async (userId) => {
  await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
  return { success: true, message: 'Todas las notificaciones marcadas como leídas' };
};

// MÉTODOS PARA WORKER DE COLAS (Background Jobs)

/**
 * Obtiene un lote de entregas pendientes para procesar.
 */
export const getPendingDeliveriesForWorker = async (limit = 50) => {
  return await notificationRepository.findPendingDeliveries(limit);
};

/**
 * Actualiza el estado de una entrega (éxito o fallo).
 */
export const updateDelivery = async (deliveryId, status, errorMessage = null) => {
  try {
    const updated = await notificationRepository.updateDeliveryStatus(
      deliveryId,
      status,
      errorMessage
    );
    return updated;
  } catch (err) {
    throw translatePrismaError(err);
  }
};

export default {
  getUnreadCount,
  listNotifications,
  createNotification,
  updateNotification,
  markAllAsRead,
  getPendingDeliveriesForWorker,
  updateDelivery,
};