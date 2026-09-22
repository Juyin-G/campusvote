// src/modules/fairJuryCategoryAssignments/fairJuryCategoryAssignment.schema.js
// Validación (Zod) con envelope { params, query, body } que exige
// validate.middleware.js.

import { z } from 'zod';

const uuid = (label = 'ID') => z.string().uuid(`${label} debe ser un UUID válido`);

const fairIdParam = z.object({
  id: uuid('El ID de la feria'),
});

export const listJuryCategoryAssignmentsSchema = z.object({
  params: z.object({
    id: uuid('El ID de la feria'),
    userId: uuid('El ID del usuario'),
  }),
});

export const assignJuryCategorySchema = z.object({
  params: z.object({
    id: uuid('El ID de la feria'),
    userId: uuid('El ID del usuario'),
  }),
  body: z
    .object({
      category_id: uuid('El category_id'),
    })
    .strict(),
});

export const removeJuryCategorySchema = z.object({
  params: z.object({
    id: uuid('El ID de la feria'),
    userId: uuid('El ID del usuario'),
    categoryId: uuid('El ID de la categoría'),
  }),
});

export default {
  listJuryCategoryAssignmentsSchema,
  assignJuryCategorySchema,
  removeJuryCategorySchema,
};
