// src/modules/organizations/organization.schema.js

import { z } from 'zod';

export const organizationTypeEnum = z.enum([
  'UNIVERSITY',
  'INSTITUTE',
  'SCHOOL',
  'COMPANY',
  'ASSOCIATION',
  'OTHER',
]);

export const organizationRequestStatusEnum = z.enum([
  'PENDING',
  'APPROVED',
  'REJECTED',
]);

// Permite URL válida, string vacío, null o undefined
const optionalUrlSchema = z
  .string()
  .url('El logo debe ser una URL válida')
  .or(z.literal(''))
  .nullable()
  .optional();

const optionalNullableString = (maxLen) =>
  z.string().trim().max(maxLen).nullable().optional().or(z.literal(''));

export const idParamSchema = z.object({
  id: z.string().uuid('El ID debe ser un UUID válido'),
});

// Validación de filtros en consultas GET
export const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  search: z.string().trim().optional(),
  is_active: z.enum(['true', 'false']).optional(),
  status: organizationRequestStatusEnum.optional(),
});

export const createOrganizationSchema = z.object({
  name: z
    .string({ required_error: 'El nombre de la organización es obligatorio' })
    .trim()
    .min(1, 'El nombre no puede estar vacío')
    .max(200, 'El nombre no puede exceder los 200 caracteres'),

  code: z
    .string({ required_error: 'El código de la organización es obligatorio' })
    .trim()
    .toUpperCase()
    .min(1, 'El código no puede estar vacío')
    .max(30, 'El código no puede exceder los 30 caracteres'),

  org_type: organizationTypeEnum.default('UNIVERSITY'),
  logo: optionalUrlSchema,

  primary_color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'El color primario debe ser un hex válido (ej: #0066CC)')
    .optional()
    .default('#0066CC'),

  secondary_color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'El color secundario debe ser un hex válido (ej: #FFD700)')
    .optional()
    .default('#FFD700'),

  country: z
    .string()
    .trim()
    .min(1, 'El país es obligatorio')
    .max(100, 'El país no puede exceder los 100 caracteres')
    .optional()
    .default('Perú'),

  timezone: z
    .string()
    .trim()
    .min(1, 'La zona horaria es obligatoria')
    .max(50, 'La zona horaria no puede exceder los 50 caracteres')
    .optional()
    .default('America/Lima'),
});

export const updateOrganizationSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    code: z.string().trim().toUpperCase().min(1).max(30).optional(),
    org_type: organizationTypeEnum.optional(),
    logo: optionalUrlSchema,
    primary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    secondary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    country: z.string().trim().min(1).max(100).optional(),
    timezone: z.string().trim().min(1).max(50).optional(),
    is_active: z.boolean().optional(),
    onboarding_completed: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Debes proporcionar al menos un campo para actualizar',
  });

export const createOrganizationRequestSchema = z.object({
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
    .positive('El número de miembros debe ser mayor a 0'),

  contact_email: z
    .string({ required_error: 'El correo de contacto es obligatorio' })
    .trim()
    .email('El correo electrónico no tiene un formato válido')
    .toLowerCase()
    .max(255, 'El correo no puede exceder los 255 caracteres'),

  contact_phone: optionalNullableString(20),
  message: optionalNullableString(1000),
});

export const rejectReasonBodySchema = z.object({
  rejection_reason: z
    .string({ required_error: 'El motivo de rechazo es obligatorio' })
    .trim()
    .min(1, 'El motivo de rechazo no puede estar vacío')
    .max(500, 'El motivo de rechazo no puede exceder los 500 caracteres'),
});

export default {
  idParamSchema,
  listQuerySchema,
  createOrganizationSchema,
  updateOrganizationSchema,
  createOrganizationRequestSchema,
  rejectReasonBodySchema,
  organizationTypeEnum,
  organizationRequestStatusEnum,
};