// src/modules/ballots/ballotPosition.schema.js
// S5-04 — Validaciones Zod de ballot_positions.

import { z } from 'zod';

const uuid = (label) =>
  z.string().uuid(`${label} inválido`);

const orderIndex = z.coerce
  .number()
  .int('El orden debe ser un número entero')
  .min(1, 'El orden debe ser mayor a 0')
  .max(
    32767,
    'El orden excede el máximo permitido',
  );

/**
 * Listar posiciones de una boleta.
 * Ejemplo:
 * GET /api/ballots/:ballotId/positions
 */
export const listBallotPositionSchema = z.object({
  params: z.object({
    ballotId: uuid('ID de boleta'),
  }),
});

/**
 * Obtener/eliminar posición específica.
 *
 * /api/ballots/:ballotId/positions/:id
 */
export const ballotPositionParamsSchema = z.object({
  params: z.object({
    ballotId: uuid('ID de boleta'),
    id: uuid('ID de posición de boleta'),
  }),
});

/**
 * Agregar una posición a una boleta.
 */
export const createBallotPositionSchema = z.object({
  params: z.object({
    ballotId: uuid('ID de boleta'),
  }),

  body: z.object({
    position_id: uuid('ID de cargo'),

    order_index: orderIndex.optional(),
  }),
});

/**
 * Actualizar la posición dentro de la boleta.
 * Principalmente se utiliza para cambiar su orden.
 */
export const updateBallotPositionSchema = z.object({
  params: z.object({
    ballotId: uuid('ID de boleta'),
    id: uuid('ID de posición de boleta'),
  }),

  body: z
    .object({
      position_id: uuid('ID de cargo').optional(),
      order_index: orderIndex.optional(),
    })
    .refine(
      (data) => Object.keys(data).length > 0,
      'Al menos un campo debe ser proporcionado',
    ),
});

export default {
  listBallotPositionSchema,
  ballotPositionParamsSchema,
  createBallotPositionSchema,
  updateBallotPositionSchema,
};