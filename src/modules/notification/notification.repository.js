// src/modules/notification/notification.repository.js

import { prisma } from '../../database/prisma.js';

const NOTIFICATION_SELECT = {
  id: true,
  userId: true,
  type: true,
  title: true,
  message: true,
  metadata: true,
  readAt: true,
  createdAt: true,
};

const DELIVERY_SELECT = {
  id: true,
  notificationId: true,
  channel: true,
  status: true,
  attemptCount: true,
  nextAttemptAt: true,
  errorMessage: true,
  sentAt: true,
  createdAt: true,
};

/**
 * Obtiene el conteo de notificaciones no leídas de un usuario.
 * (Aprovecha el índice parcial idx_notifications_user_unread)
 */
export const countUnreadNotifications = (userId) =>
  prisma.notification.count({
    where: {
      userId,
      readAt: null,
    },
  });

/**
 * Lista las notificaciones de un usuario con paginación y filtros.
 */
export const findNotificationsByUser = (userId, { page, limit, type, isRead }) => {
  const skip = (page - 1) * limit;
  const where = { userId };

  if (type) where.type = type;
  if (isRead !== undefined) {
    where.readAt = isRead ? { not: null } : null;
  }

  return prisma.notification.findMany({
    where,
    select: NOTIFICATION_SELECT,
    orderBy: { createdAt: 'desc' },
    skip,
    take: limit,
  });
};

/**
 * Crea una notificación y sus registros de entrega en una sola transacción.
 */
export const createNotificationWithDeliveries = async (notificationData, channels) => {
  return prisma.$transaction(async (tx) => {
    // 1. Crear la notificación principal
    const notification = await tx.notification.create({
      data: notificationData,
      select: NOTIFICATION_SELECT,
    });

    // 2. Crear los registros de entrega para cada canal solicitado
    const deliveries = await Promise.all(
      channels.map((channel) =>
        tx.notificationDelivery.create({
          data: {
            notificationId: notification.id,
            channel,
            status: 'PENDING',
            attemptCount: 0,
            nextAttemptAt: new Date(),
          },
          select: DELIVERY_SELECT,
        })
      )
    );

    return { notification, deliveries };
  });
};

/**
 * Marca una notificación como leída (o no leída).
 */
export const updateNotificationReadStatus = (id, userId, isRead) =>
  prisma.notification.update({
    where: { id, userId }, // El userId en el where asegura que el usuario solo marque SUS propias notificaciones
    data: {
      readAt: isRead ? new Date() : null,
    },
    select: NOTIFICATION_SELECT,
  });

/**
 * Actualiza el estado de un registro de entrega (Usado por el Worker de colas).
 */
export const updateDeliveryStatus = (id, status, errorMessage = null) => {
  const data = { status };
  
  if (status === 'SENT') {
    data.sentAt = new Date();
  } else if (status === 'FAILED') {
    data.errorMessage = errorMessage;
    data.attemptCount = { increment: 1 };
    // Programar el próximo intento (ej: en 5 minutos)
    data.nextAttemptAt = new Date(Date.now() + 5 * 60 * 1000); 
  }

  return prisma.notificationDelivery.update({
    where: { id },
    data,
    select: DELIVERY_SELECT,
  });
};

/**
 * Obtiene entregas pendientes para el worker de procesamiento.
 */
export const findPendingDeliveries = (limit = 50) =>
  prisma.notificationDelivery.findMany({
    where: {
      status: 'PENDING',
      nextAttemptAt: { lte: new Date() },
    },
    select: {
      ...DELIVERY_SELECT,
      notification: {
        select: {
          userId: true,
          type: true,
          title: true,
          message: true,
          metadata: true,
        },
      },
    },
    orderBy: { nextAttemptAt: 'asc' },
    take: limit,
  });

export default {
  countUnreadNotifications,
  findNotificationsByUser,
  createNotificationWithDeliveries,
  updateNotificationReadStatus,
  updateDeliveryStatus,
  findPendingDeliveries,
};