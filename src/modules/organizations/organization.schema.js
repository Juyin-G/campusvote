const { z } = require('zod');

const organizationTypeEnum = z.enum([
  'UNIVERSITY',
  'INSTITUTE',
  'SCHOOL',
  'COMPANY',
  'ASSOCIATION',
  'OTHER'
]);

const organizationRequestStatusEnum = z.enum([
  'PENDING',
  'APPROVED',
  'REJECTED'
]);

// Permite URL válida, string vacío, null o undefined
const optionalUrlSchema = z
  .string()
  .url('El logo debe ser una URL válida')
  .or(z.literal(''))
  .nullable()
  .optional();

const optionalNullableString = (maxLen) =>
  z.string().max(maxLen).nullable().optional().or(z.literal(''));

const idParamSchema = z.object({
  id: z.string().uuid('El ID debe ser un UUID válido')
});

// Validación de filtros en consultas GET
const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  search: z.string().trim().optional(),
  is_active: z.enum(['true', 'false']).optional(),
  status: organizationRequestStatusEnum.optional()
});

const createOrganizationSchema = z.object({
  name: z
    .string({ required_error: 'El nombre de la organización es obligatorio' })
    .min(1, 'El nombre no puede estar vacío')
    .max(200, 'El nombre no puede exceder los 200 caracteres')
    .trim(),
    
  code: z
    .string({ required_error: 'El código de la organización es obligatorio' })
    .min(1, 'El código no puede estar vacío')
    .max(30, 'El código no puede exceder los 30 caracteres')
    .trim()
    .toUpperCase(),
    
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
    .min(1, 'El país es obligatorio')
    .max(100, 'El país no puede exceder los 100 caracteres')
    .optional()
    .default('Perú'),
    
  timezone: z
    .string()
    .min(1, 'La zona horaria es obligatoria')
    .max(50, 'La zona horaria no puede exceder los 50 caracteres')
    .optional()
    .default('America/Lima')
});

const updateOrganizationSchema = z.object({
  name: z.string().min(1).max(200).trim().optional(),
  code: z.string().min(1).max(30).trim().toUpperCase().optional(),
  org_type: organizationTypeEnum.optional(),
  logo: optionalUrlSchema,
  primary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  secondary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  country: z.string().min(1).max(100).optional(),
  timezone: z.string().min(1).max(50).optional(),
  is_active: z.boolean().optional(),
  onboarding_completed: z.boolean().optional()
}).refine(data => Object.keys(data).length > 0, {
  message: 'Debes proporcionar al menos un campo para actualizar'
});

const createOrganizationRequestSchema = z.object({
  institution_name: z
    .string({ required_error: 'El nombre de la institución es obligatorio' })
    .min(1, 'El nombre no puede estar vacío')
    .max(200, 'El nombre no puede exceder los 200 caracteres')
    .trim(),
    
  institution_type: organizationTypeEnum,
  
  country: z
    .string({ required_error: 'El país es obligatorio' })
    .min(1, 'El país no puede estar vacío')
    .max(100, 'El país no puede exceder los 100 caracteres')
    .trim(),
    
  estimated_members: z.coerce
    .number({ required_error: 'El número estimado de miembros es obligatorio' })
    .int('Debe ser un número entero')
    .positive('El número de miembros debe ser mayor a 0'),
    
  contact_email: z
    .string({ required_error: 'El correo de contacto es obligatorio' })
    .email('El correo electrónico no tiene un formato válido')
    .toLowerCase()
    .max(255, 'El correo no puede exceder los 255 caracteres'),
    
  contact_phone: optionalNullableString(20),
  message: optionalNullableString(1000)
});

const rejectReasonBodySchema = z.object({
  rejection_reason: z
    .string({ required_error: 'El motivo de rechazo es obligatorio' })
    .min(1, 'El motivo de rechazo no puede estar vacío')
    .max(500, 'El motivo de rechazo no puede exceder los 500 caracteres')
    .trim()
});

module.exports = {
  idParamSchema,
  listQuerySchema,
  createOrganizationSchema,
  updateOrganizationSchema,
  createOrganizationRequestSchema,
  rejectReasonBodySchema,
  organizationTypeEnum,
  organizationRequestStatusEnum
};