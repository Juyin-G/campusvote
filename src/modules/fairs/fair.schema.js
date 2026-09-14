// src/modules/fairs/fair.schema.js
// Validación (Zod) con envelope { params, query, body } que exige
// validate.middleware.js.

import { z } from 'zod';

const uuid = (label = 'ID') => z.string().uuid(`${label} debe ser un UUID válido`);

const nameField = z
  .string()
  .trim()
  .min(3, 'El nombre debe tener al menos 3 caracteres')
  .max(200, 'El nombre no puede superar los 200 caracteres');

const descriptionField = z
  .string()
  .trim()
  .max(5000, 'La descripción no puede superar los 5000 caracteres');

const fairStatusEnum = z.enum(['DRAFT', 'OPEN', 'CLOSED']);

// Fecha opcional: acepta ISO (string), se transforma a Date, o null/'' para limpiarla.
const dateField = z
  .union([z.literal(''), z.null(), z.coerce.date()])
  .transform((value) => (value === '' || value === null ? null : value));

export const idParamSchema = z.object({
  params: z.object({
    id: uuid('El ID de la feria'),
  }),
});

export const listFairsQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    status: fairStatusEnum.optional(),
  }),
});

export const createFairSchema = z.object({
  body: z
    .object({
      name: nameField,
      description: descriptionField.optional(),
      starts_at: dateField.optional(),
      ends_at: dateField.optional(),
      registration_deadline: dateField.optional(),
      site_id: z.union([z.literal(''), z.null(), uuid('El site_id')]).transform((v) => v || null).optional(),
    })
    .strict(),
});

export const updateFairSchema = z.object({
  params: idParamSchema.shape.params,
  body: z
    .object({
      name: nameField.optional(),
      description: descriptionField.optional(),
      starts_at: dateField.optional(),
      ends_at: dateField.optional(),
      registration_deadline: dateField.optional(),
      site_id: z.union([z.literal(''), z.null(), uuid('El site_id')]).transform((v) => v || null).optional(),
    })
    .strict()
    .refine((data) => Object.values(data).some((value) => value !== undefined), {
      message: 'Debes proporcionar al menos un campo para actualizar',
    }),
});

export const changeStatusSchema = z.object({
  params: idParamSchema.shape.params,
  body: z
    .object({
      status: fairStatusEnum,
    })
    .strict(),
});

export default {
  idParamSchema,
  listFairsQuerySchema,
  createFairSchema,
  updateFairSchema,
  changeStatusSchema,
};