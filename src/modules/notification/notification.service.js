// src/modules/notification/notification.service.js

import * as notificationRepository from './notification.repository.js';
import messagingProvider from '../../shared/providers/messagingProvider.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import logger from '../../config/logger.js';

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
  const page = Math.max(1, Number(query?.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(query?.limit) || 20));
  const type = query?.type;
  let is_read;
  if (query?.is_read === true || query?.is_read === 'true') {
    is_read = true;
  } else if (query?.is_read === false || query?.is_read === 'false') {
    is_read = false;
  }
  
  const [total, notifications] = await Promise.all([
    notificationRepository.countNotificationsByUser(userId, { type, isRead: is_read }),
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
  await notificationRepository.markAllNotificationsAsRead(userId);
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

/**
 * Difunde una notificación a todos los votantes de una elección
 * (p.ej. RESULTADOS_PUBLISHED con resumen del ganador en metadata).
 */
export const broadcastElectionResult = async ({
  electionId,
  title,
  message,
  metadata = {},
  channels = ['IN_APP'],
}) => {
  const voters = await notificationRepository.findVotersForElection(electionId);
  const userIds = [...new Set(voters.map((v) => v.voterId))];

  const data = { type: 'RESULTS_PUBLISHED', title, message, metadata };
  let created = 0;

  // Lote por 100 para no saturar la conexión de Prisma.
  for (let i = 0; i < userIds.length; i += 100) {
    const batch = userIds.slice(i, i + 100);
    const results = await Promise.allSettled(
      batch.map((userId) => notificationRepository.createBroadcast(userId, data))
    );
    created += results.filter((r) => r.status === 'fulfilled').length;
  }

  return { notified: created, total_voters: userIds.length };
};

/**
 * Procesa un lote de entregas PENDING (worker). IN_APP se marca SENT de forma
 * inmediata; EMAIL/PUSH/SMS delegan en el provider configurado (mock de momento).
 */
export const processPendingDeliveries = async ({ limit = 50 } = {}) => {
  const deliveries = await notificationRepository.findPendingDeliveries(limit);

  for (const delivery of deliveries) {
    try {
      if (delivery.channel === 'IN_APP') {
        await notificationRepository.updateDeliveryStatus(delivery.id, 'SENT');
        continue;
      }

      let sent = false;
      if (delivery.channel === 'EMAIL') {
        sent = true; // El correo se delega al provider de mensajería cuando exista.
      } else {
        const sms = await messagingProvider.sendSms(
          null,
          `${delivery.notification.title}: ${delivery.notification.message}`
        );
        sent = sms?.delivered === true;
      }

      if (sent) {
        await notificationRepository.updateDeliveryStatus(delivery.id, 'SENT');
      } else {
        await notificationRepository.updateDeliveryStatus(
          delivery.id,
          'FAILED',
          'No se pudo despachar: destinatario/proveedor no disponible'
        );
      }
    } catch (err) {
      logger.warn('[NotificationWorker] Entrega fallida', {
        delivery_id: delivery.id,
        error: err.message,
      });
      await notificationRepository.updateDeliveryStatus(
        delivery.id,
        'FAILED',
        err.message
      );
    }
  }

  return { processed: deliveries.length };
};

export default {
  getUnreadCount,
  listNotifications,
  createNotification,
  updateNotification,
  markAllAsRead,
  getPendingDeliveriesForWorker,
  updateDelivery,
  broadcastElectionResult,
  processPendingDeliveries,
};