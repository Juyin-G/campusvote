// src/modules/notification/notification.schema.js

import { z } from 'zod';

const uuid = (label) => z.string().uuid(`${label} inválido`);

// Enums alineados con la base de datos
const NOTIFICATION_TYPES = [
  'ELECTION_OPENING',
  'VOTE_CONFIRMATION',
  'RESULTS_PUBLISHED',
  'CANDIDACY_APPROVED',
  'SYSTEM_ALERT',
];

const DELIVERY_CHANNELS = ['IN_APP', 'EMAIL', 'PUSH'];
const DELIVERY_STATUSES = ['PENDING', 'SENT', 'FAILED'];


// Validaciones de campos base (alineadas con CHECKs de SQL)
const title = z
  .string()
  .max(150, 'El título no puede exceder 150 caracteres')
  .refine((val) => val.trim().length > 0, 'El título no puede estar vacío');

const message = z
  .string()
  .refine((val) => val.trim().length > 0, 'El mensaje no puede estar vacío');

// Metadata debe ser un objeto JSON (Prisma lo manejará como Json/JSONB)
const metadata = z
  .record(z.string(), z.any())
  .optional()
  .default({});

/**
 * GET /api/notifications
 * Listar notificaciones del usuario autenticado
 */
export const listNotificationsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    type: z.enum(NOTIFICATION_TYPES).optional(),
    // Transformamos string 'true'/'false' a booleano real para el servicio
    is_read: z
      .enum(['true', 'false'])
      .transform((val) => val === 'true')
      .optional(),
  }),
});

/**
 * GET / PATCH / DELETE /api/notifications/:id
 * Parámetros de ruta para una notificación específica
 */
export const notificationParamsSchema = z.object({
  params: z.object({
    id: uuid('ID de notificación'),
  }),
});

/**
 * POST /api/notifications
 * Crear una nueva notificación (Generalmente usado por Admin/Sistema)
 */
export const createNotificationSchema = z.object({
  body: z.object({
    user_id: uuid('ID de usuario destinatario'),
    type: z.enum(NOTIFICATION_TYPES, {
      error_map: () => ({ message: 'Tipo de notificación no válido' }),
    }),
    title: title,
    message: message,
    metadata: metadata,
    // Opcional: Canales por los cuales se debe programar la entrega
    channels: z.array(z.enum(DELIVERY_CHANNELS)).optional().default(['IN_APP']),
  }),
});

/**
 * PATCH /api/notifications/:id
 * Actualizar una notificación (ej. marcar como leída)
 */
export const updateNotificationSchema = z.object({
  params: z.object({
    id: uuid('ID de notificación'),
  }),
  body: z
    .object({
      // Helper para marcar como leída (el servicio lo convertirá a read_at = now())
      is_read: z.boolean().optional(),
      metadata: metadata.optional(),
    })
    .refine(
      (data) => Object.keys(data).length > 0,
      'Debe proporcionar al menos un campo para actualizar'
    ),
});

/**
 * PATCH /api/notifications/deliveries/:id
 * Actualizar el estado de entrega (Usado internamente por el Worker de colas)
 */
export const updateDeliverySchema = z.object({
  params: z.object({
    id: uuid('ID de registro de entrega'),
  }),
  body: z.object({
    status: z.enum(DELIVERY_STATUSES),
    error_message: z.string().max(1000).optional(), // Para cuando status = 'FAILED'
  }),
});

/**
 * GET /api/notifications/unread-count
 * Obtener conteo de no leídas (sin parámetros, solo auth)
 */
export const unreadCountSchema = z.object({
  // No requiere params ni query, solo validación de que el request existe
});