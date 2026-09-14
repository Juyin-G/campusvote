// src/modules/fairStands/fairStand.schema.js
// Validación (Zod) con envelope { params, query, body } que exige
// validate.middleware.js.

import { z } from 'zod';

const uuid = (label = 'ID') => z.string().uuid(`${label} debe ser un UUID válido`);

const codeField = z
  .string()
  .trim()
  .min(1, 'El código no puede estar vacío')
  .max(100, 'El código no puede superar los 100 caracteres');

const descriptionField = z
  .string()
  .trim()
  .max(5000, 'La descripción no puede superar los 5000 caracteres');

const fairParam = z.object({
  id: uuid('El ID de la feria'),
});

export const listStandsSchema = z.object({
  params: fairParam,
});

export const createStandSchema = z.object({
  params: fairParam,
  body: z
    .object({
      code: codeField,
      description: descriptionField.optional(),
    })
    .strict(),
});

export const updateStandSchema = z.object({
  params: z.object({
    id: uuid('El ID de la feria'),
    standId: uuid('El ID del stand'),
  }),
  body: z
    .object({
      code: codeField.optional(),
      description: descriptionField.optional(),
    })
    .strict()
    .refine((data) => Object.values(data).some((value) => value !== undefined), {
      message: 'Debes proporcionar al menos un campo para actualizar',
    }),
});

export const deleteStandSchema = z.object({
  params: z.object({
    id: uuid('El ID de la feria'),
    standId: uuid('El ID del stand'),
  }),
});

export default {
  listStandsSchema,
  createStandSchema,
  updateStandSchema,
  deleteStandSchema,
};