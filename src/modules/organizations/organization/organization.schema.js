import { z } from 'zod';

const uuid = (label) => z.string().uuid(`${label} inválido`);

export const organizationTypeEnum = z.enum(
  ['UNIVERSITY', 'INSTITUTE', 'SCHOOL', 'COMPANY', 'ASSOCIATION', 'OTHER'],
  {
    required_error: 'El tipo de organización es obligatorio',
    invalid_type_error: 'El tipo de organización no es válido',
  }
);

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
  z
    .string()
    .trim()
    .max(maxLen)
    .nullable()
    .optional()
    .or(z.literal(''));

// Dominios de correo permitidos (ej: "universidad.edu.pe", "gmail.com").
// Se acepta con o sin el "@"; se normaliza quitando el "@" inicial.
const emailDomainsSchema = z
  .array(
    z
      .string()
      .trim()
      .min(2, 'Un dominio debe tener al menos 2 caracteres')
      .max(255, 'El dominio no puede exceder los 255 caracteres')
      .regex(/^@?[a-zA-Z0-9.-]+$/, 'Dominio de correo inválido')
      .transform((d) => d.replace(/^@/, '')),
  )
  .max(100, 'No puedes configurar más de 100 dominios')
  .optional();

// ==========================================
// PARÁMETROS DE RUTA
// ==========================================

export const organizationParamsSchema = z.object({
  params: z.object({
    id: uuid('ID de la organización'),
  }),
});

export const idParamSchema = organizationParamsSchema;

// ==========================================
// LISTAR ORGANIZACIONES
// ==========================================

export const listOrganizationsQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(10),
    search: z.string().trim().optional(),
    is_active: z
      .enum(['true', 'false'])
      .transform((val) => val === 'true')
      .optional(),
    status: organizationRequestStatusEnum.optional(),
    org_type: organizationTypeEnum.optional(),
  }),
});

export const listQuerySchema = listOrganizationsQuerySchema;

// ==========================================
// CREAR ORGANIZACIÓN
// ==========================================

export const createOrganizationSchema = z.object({
  body: z.object({
    name: z
      .string({
        required_error: 'El nombre de la organización es obligatorio',
      })
      .trim()
      .min(1, 'El nombre no puede estar vacío')
      .max(200, 'El nombre no puede exceder los 200 caracteres'),

    code: z
      .string({
        required_error: 'El código de la organización es obligatorio',
      })
      .trim()
      .min(1, 'El código no puede estar vacío')
      .max(30, 'El código no puede exceder los 30 caracteres')
      .transform((val) => val.toUpperCase()),

    org_type: organizationTypeEnum.default('UNIVERSITY'),

    logo: optionalUrlSchema,

    primary_color: z
      .string()
      .regex(
        /^#[0-9a-fA-F]{6}$/,
        'El color primario debe ser un hex válido (ej: #0066CC)'
      )
      .optional()
      .default('#0066CC'),

    secondary_color: z
      .string()
      .regex(
        /^#[0-9a-fA-F]{6}$/,
        'El color secundario debe ser un hex válido (ej: #FFD700)'
      )
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

    allowed_email_domains: emailDomainsSchema,
  }),
});

// ==========================================
// ACTUALIZAR ORGANIZACIÓN
// ==========================================

export const updateOrganizationSchema = z.object({
  body: z
    .object({
      name: z
        .string()
        .trim()
        .min(1, 'El nombre no puede estar vacío')
        .max(200, 'El nombre no puede exceder los 200 caracteres')
        .optional(),

      code: z
        .string()
        .trim()
        .min(1, 'El código no puede estar vacío')
        .max(30, 'El código no puede exceder los 30 caracteres')
        .transform((val) => val.toUpperCase())
        .optional(),

      org_type: organizationTypeEnum.optional(),

      logo: optionalUrlSchema,

      primary_color: z
        .string()
        .regex(
          /^#[0-9a-fA-F]{6}$/,
          'El color primario debe ser un hex válido'
        )
        .optional(),

      secondary_color: z
        .string()
        .regex(
          /^#[0-9a-fA-F]{6}$/,
          'El color secundario debe ser un hex válido'
        )
        .optional(),

      country: z
        .string()
        .trim()
        .min(1, 'El país no puede estar vacío')
        .max(100, 'El país no puede exceder los 100 caracteres')
        .optional(),

      timezone: z
        .string()
        .trim()
        .min(1, 'La zona horaria no puede estar vacía')
        .max(50, 'La zona horaria no puede exceder los 50 caracteres')
        .optional(),

      is_active: z.boolean().optional(),

      onboarding_completed: z.boolean().optional(),

      allowed_email_domains: emailDomainsSchema,
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'Debes proporcionar al menos un campo para actualizar',
    }),
});

export default {
  organizationParamsSchema,
  idParamSchema,
  listOrganizationsQuerySchema,
  listQuerySchema,
  createOrganizationSchema,
  updateOrganizationSchema,
  organizationTypeEnum,
  organizationRequestStatusEnum,
};