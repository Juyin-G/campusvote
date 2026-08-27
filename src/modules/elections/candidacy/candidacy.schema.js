// src/modules/elections/candidacy/candidacy.schema.js

import { z } from 'zod';

const uuid = (label) => z.string().uuid(`${label} inválido`);

// chk_candidacies_order_positive: order_index >= 1 (PostgreSQL SMALLINT: max 32767)
const orderIndex = z.coerce
  .number({ invalid_type_error: 'El orden debe ser un número entero' })
  .int('El orden debe ser un número entero')
  .min(1, 'El orden debe ser 1 o mayor')
  .max(32767, 'El orden excede el límite máximo de 32767');

/**
 * GET /api/elections/:electionId/candidacies
 */
export const listCandidacySchema = z.object({
  params: z.object({
    electionId: uuid('ID de elección'),
  }),
  query: z.object({
    candidate_list_id: uuid('ID de lista de candidatos').optional(),
    position_id: uuid('ID de cargo').optional(),
  }),
});

/**
 * GET / DELETE /api/elections/:electionId/candidacies/:id
 */
export const candidacyParamsSchema = z.object({
  params: z.object({
    electionId: uuid('ID de elección'),
    id: uuid('ID de candidatura'),
  }),
});

/**
 * POST /api/elections/:electionId/candidacies
 */
export const createCandidacySchema = z.object({
  params: z.object({
    electionId: uuid('ID de elección'),
  }),
  body: z.object({
    candidate_list_id: uuid('ID de lista de candidatos'),
    user_id: uuid('ID de usuario'),
    position_id: uuid('ID de cargo').nullable().optional(),
    order_index: orderIndex.optional().default(1),
    is_principal: z.boolean({ invalid_type_error: 'is_principal debe ser un valor booleano' }).optional().default(true),
  }),
});

/**
 * PATCH /api/elections/:electionId/candidacies/:id
 * user_id y status son inmutables por regla de negocio en este endpoint.
 */
export const updateCandidacySchema = z.object({
  params: z.object({
    electionId: uuid('ID de elección'),
    id: uuid('ID de candidatura'),
  }),
  body: z
    .object({
      candidate_list_id: uuid('ID de lista de candidatos').optional(),
      position_id: uuid('ID de cargo').nullable().optional(),
      order_index: orderIndex.optional(),
      is_principal: z.boolean({ invalid_type_error: 'is_principal debe ser un valor booleano' }).optional(),
    })
    .refine(
      (data) => Object.keys(data).length > 0,
      'Debe proporcionar al menos un campo para actualizar'
    ),
});