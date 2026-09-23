// src/modules/organizations/organization-request/organization.schema.js

import { z } from 'zod';

const uuid = (label) => z.string().uuid(`${label} inválido`);

export const organizationTypeEnum = z.enum(
  ['UNIVERSITY', 'INSTITUTE', 'SCHOOL', 'COMPANY', 'ASSOCIATION', 'OTHER'],
  {
    required_error: 'El tipo de institución es obligatorio',
    invalid_type_error: 'El tipo de institución no es válido',
  }
);

export const organizationRequestStatusEnum = z.enum([
  'PENDING',
  'APPROVED',
  'REJECTED',
]);

const emailSchema = z
  .string({ required_error: 'El correo electrónico es obligatorio' })
  .trim()
  .toLowerCase()
  .email('El correo electrónico no tiene un formato válido')
  .max(255, 'El correo no puede exceder los 255 caracteres');

/**
 * Helper para campos opcionales que convierte cadenas vacías ("") o espacios en null.
 */
const optionalNullableString = (maxLen) =>
  z
    .string()
    .trim()
    .max(maxLen, `No puede exceder los ${maxLen} caracteres`)
    .optional()
    .nullable()
    .transform((val) => (val === '' ? null : val));

/**
 * POST /api/organizations/requests
 * Crear una nueva solicitud de organización
 */
export const createOrganizationRequestSchema = z.object({
  body: z.object({
    institution_name: z
      .string({ required_error: 'El nombre de la institución es obligatorio' })
      .trim()
      .min(1, 'El nombre no puede estar vacío')
      .max(200, 'El nombre no puede exceder los 200 caracteres'),

    institution_type: organizationTypeEnum,

    country: z
      .string({ required_error: 'El país es obligatorio' })
      .trim()
      .min(1, 'El país no puede estar vacío')
      .max(100, 'El país no puede exceder los 100 caracteres'),

    estimated_members: z.coerce
      .number({ required_error: 'El número estimado de miembros es obligatorio' })
      .int('Debe ser un número entero')
      .positive('El número de miembros debe ser mayor a 0')
      .max(1000000, 'El número de miembros es demasiado alto'),

    contact_email: emailSchema,
    contact_phone: optionalNullableString(20),
    message: optionalNullableString(1000),
  }),
});

/**
 * GET /api/organizations/requests
 * Listar solicitudes con filtros
 */
export const listRequestsQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(10),
    status: organizationRequestStatusEnum.optional(),
  }),
});

/**
 * GET /api/organizations/requests/:id
 * Obtener solicitud por ID
 */
export const requestParamsSchema = z.object({
  params: z.object({
    id: uuid('ID de solicitud'),
  }),
});

/**
 * PATCH /api/organizations/requests/:id/approve
 * Aprobar solicitud
 */
export const approveRequestSchema = z.object({
  params: z.object({
    id: uuid('ID de solicitud'),
  }),
});

/**
 * PATCH /api/organizations/requests/:id/reject
 * Rechazar solicitud con motivo
 */
export const rejectRequestSchema = z.object({
  params: z.object({
    id: uuid('ID de solicitud'),
  }),
  body: z.object({
    rejection_reason: z
      .string({ required_error: 'El motivo de rechazo es obligatorio' })
      .trim()
      .min(1, 'El motivo de rechazo no puede estar vacío')
      .max(500, 'El motivo de rechazo no puede exceder los 500 caracteres'),
  }),
});

export default {
  createOrganizationRequestSchema,
  listRequestsQuerySchema,
  requestParamsSchema,
  approveRequestSchema,
  rejectRequestSchema,
  organizationTypeEnum,
  organizationRequestStatusEnum,
};