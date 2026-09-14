// src/modules/juryAssignments/juryAssignment.schema.js
// Validación (Zod) con envelope { params, query, body } que exige
// validate.middleware.js.

import { z } from 'zod';

const uuid = (label = 'ID') => z.string().uuid(`${label} debe ser un UUID válido`);

const fairIdParamSchema = z.object({
  id: uuid('El ID de la feria'),
});

export const listJuriesSchema = z.object({
  params: fairIdParamSchema,
});

export const assignJurySchema = z.object({
  params: fairIdParamSchema,
  body: z
    .object({
      user_id: uuid('El user_id'),
    })
    .strict(),
});

export const juryOfFairSchema = z.object({
  params: z.object({
    id: uuid('El ID de la feria'),
    userId: uuid('El ID del usuario'),
  }),
});

export const listMyAssignmentsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
});

export const myAssignmentDetailSchema = z.object({
  params: z.object({
    fairId: uuid('El ID de la feria'),
  }),
});

export default {
  listJuriesSchema,
  assignJurySchema,
  juryOfFairSchema,
  listMyAssignmentsSchema,
  myAssignmentDetailSchema,
};