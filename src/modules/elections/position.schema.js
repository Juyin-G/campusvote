// src/modules/elections/position.schema.js
// S4-05 — Validación Zod de cargos. Refleja los CHECK de la tabla `positions`.

import { z } from 'zod';

const uuid = (label) => z.string().uuid(`${label} inválido`);

// chk_positions_name_not_empty: length(trim(name)) > 0, y VARCHAR(120)
const positionName = z
  .string()
  .max(120, 'Como máximo 120 caracteres')
  .refine((value) => value.trim().length > 0, 'El nombre del cargo no puede estar vacío');

// chk_positions_seats_positive: seats >= 1. La columna es SMALLINT (máx. 32767).
const seats = z.coerce
  .number()
  .int('Las plazas deben ser un número entero')
  .min(1, 'El cargo debe tener al menos 1 plaza')
  .max(32767, 'Las plazas exceden el máximo permitido');

const description = z.string().max(5000, 'Como máximo 5000 caracteres').nullable().optional();

/** Rutas anidadas: /api/elections/:electionId/positions */
export const listPositionSchema = z.object({
  params: z.object({
    electionId: uuid('ID de elección'),
  }),
});

/** /api/elections/:electionId/positions/:id */
export const positionParamsSchema = z.object({
  params: z.object({
    electionId: uuid('ID de elección'),
    id: uuid('ID de cargo'),
  }),
});

export const createPositionSchema = z.object({
  params: z.object({
    electionId: uuid('ID de elección'),
  }),
  body: z.object({
    name: positionName,
    description,
    seats: seats.optional(),
  }),
});

export const updatePositionSchema = z.object({
  params: z.object({
    electionId: uuid('ID de elección'),
    id: uuid('ID de cargo'),
  }),
  body: z
    .object({
      name: positionName.optional(),
      description,
      seats: seats.optional(),
    })
    .refine(
      (data) => Object.keys(data).length > 0,
      'Al menos un campo debe ser proporcionado'
    ),
});
