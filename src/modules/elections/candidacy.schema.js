// src/modules/elections/candidacy.schema.js
// S4-09 — Validación Zod de candidaturas.
// Refleja los CHECK y UNIQUE de la tabla `candidacies`.

import { z } from 'zod';

const uuid = (label) => z.string().uuid(`${label} inválido`);

// chk_candidacies_order_positive: order_index >= 1. La columna es SMALLINT.
const orderIndex = z.coerce
  .number()
  .int('El orden debe ser un número entero')
  .min(1, 'El orden debe ser 1 o mayor')
  .max(32767, 'El orden excede el máximo permitido');

/** /api/elections/:electionId/candidacies */
export const listCandidacySchema = z.object({
  params: z.object({
    electionId: uuid('ID de elección'),
  }),
  query: z.object({
    candidate_list_id: uuid('candidate_list_id').optional(),
    position_id: uuid('position_id').optional(),
  }),
});

/** /api/elections/:electionId/candidacies/:id */
export const candidacyParamsSchema = z.object({
  params: z.object({
    electionId: uuid('ID de elección'),
    id: uuid('ID de candidatura'),
  }),
});

export const createCandidacySchema = z.object({
  params: z.object({
    electionId: uuid('ID de elección'),
  }),
  body: z.object({
    candidate_list_id: uuid('candidate_list_id'),
    user_id: uuid('user_id'),
    // Opcional: una candidatura puede aún no tener cargo asignado.
    position_id: uuid('position_id').nullable().optional(),
    order_index: orderIndex.optional(),
    is_principal: z.boolean().optional(),
  }),
});

/**
 * user_id NO se puede modificar: cambiar la persona equivale a otra
 * candidatura distinta. Para eso se elimina esta y se crea una nueva.
 */
export const updateCandidacySchema = z.object({
  params: z.object({
    electionId: uuid('ID de elección'),
    id: uuid('ID de candidatura'),
  }),
  body: z
    .object({
      candidate_list_id: uuid('candidate_list_id').optional(),
      position_id: uuid('position_id').nullable().optional(),
      order_index: orderIndex.optional(),
      is_principal: z.boolean().optional(),
    })
    .refine(
      (data) => Object.keys(data).length > 0,
      'Al menos un campo debe ser proporcionado'
    ),
});
