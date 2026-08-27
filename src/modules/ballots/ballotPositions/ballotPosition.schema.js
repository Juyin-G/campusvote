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
 * GET /api/ballots/:ballotId/positions
 */
export const listBallotPositionSchema = z.object({
  params: z.object({
    ballotId: uuid('ID de boleta'),
  }),
});

/**
 * Obtener/eliminar posición específica.
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
 * Soporta positionId / position_id y orderIndex / order_index.
 */
export const createBallotPositionSchema = z.object({
  params: z.object({
    ballotId: uuid('ID de boleta'),
  }),

  body: z
    .object({
      positionId: uuid('ID de cargo').optional(),
      position_id: uuid('ID de cargo').optional(),
      orderIndex: orderIndex.optional(),
      order_index: orderIndex.optional(),
    })
    .transform((data) => ({
      positionId: data.positionId ?? data.position_id,
      position_id: data.positionId ?? data.position_id,
      orderIndex: data.orderIndex ?? data.order_index ?? 1,
      order_index: data.orderIndex ?? data.order_index ?? 1,
    }))
    .refine(
      (data) => Boolean(data.positionId),
      {
        message: 'El ID de cargo (positionId o position_id) es obligatorio',
        path: ['positionId'],
      }
    ),
});

/**
 * Actualizar la posición dentro de la boleta.
 * Soporta positionId / position_id y orderIndex / order_index.
 */
export const updateBallotPositionSchema = z.object({
  params: z.object({
    ballotId: uuid('ID de boleta'),
    id: uuid('ID de posición de boleta'),
  }),

  body: z
    .object({
      positionId: uuid('ID de cargo').optional(),
      position_id: uuid('ID de cargo').optional(),
      orderIndex: orderIndex.optional(),
      order_index: orderIndex.optional(),
    })
    .transform((data) => {
      const posId = data.positionId ?? data.position_id;
      const ordIdx = data.orderIndex ?? data.order_index;

      const result = {};
      if (posId !== undefined) {
        result.positionId = posId;
        result.position_id = posId;
      }
      if (ordIdx !== undefined) {
        result.orderIndex = ordIdx;
        result.order_index = ordIdx;
      }
      return result;
    })
    .refine(
      (data) => Object.keys(data).length > 0,
      'Al menos un campo debe ser proporcionado para actualizar'
    ),
});

export default {
  listBallotPositionSchema,
  ballotPositionParamsSchema,
  createBallotPositionSchema,
  updateBallotPositionSchema,
};