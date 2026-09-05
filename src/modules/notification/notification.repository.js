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
    const notification = await tx.notification.create({
      data: notificationData,
      select: NOTIFICATION_SELECT,
    });

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
    where: { id, userId },
    data: {
      readAt: isRead ? new Date() : null,
    },
    select: NOTIFICATION_SELECT,
  });

/**
 * Marca todas las notificaciones de un usuario como leídas.
 */
export const markAllNotificationsAsRead = (userId) =>
  prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });

/**
 * Actualiza el estado de un registro de entrega.
 */
export const updateDeliveryStatus = (id, status, errorMessage = null) => {
  const data = { status };
  
  if (status === 'SENT') {
    data.sentAt = new Date();
  } else if (status === 'FAILED') {
    data.errorMessage = errorMessage;
    data.attemptCount = { increment: 1 };
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

/**
 * Lista los votantes de una elección (para difundir RESULTADOS_PUBLISHED).
 */
export const findVotersForElection = (electionId, limit = 5000) =>
  prisma.vote.findMany({
    where: { electionId },
    select: { voterId: true },
    distinct: ['voterId'],
    take: limit,
  });

/**
 * Crea N notificaciones idénticas (broadcast) a una lista de destinatarios.
 */
export const createBroadcast = (userId, data) =>
  prisma.notification.create({
    data: {
      userId,
      type: data.type,
      title: data.title,
      message: data.message,
      metadata: data.metadata || {},
    },
    select: NOTIFICATION_SELECT,
  });

export default {
  countUnreadNotifications,
  findNotificationsByUser,
  createNotificationWithDeliveries,
  updateNotificationReadStatus,
  markAllNotificationsAsRead,
  updateDeliveryStatus,
  findPendingDeliveries,
  findVotersForElection,
  createBroadcast,
};