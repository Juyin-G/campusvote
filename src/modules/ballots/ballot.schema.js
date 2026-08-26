// src/modules/ballots/ballot.schema.js
// S5-07 — Validaciones Zod del recurso ballots.

import { z } from 'zod';

const uuid = (label = 'ID') =>
  z.string().uuid(`${label} inválido`);

const version = z.coerce
  .number()
  .int('La versión debe ser un número entero')
  .min(1, 'La versión debe ser mayor a 0');

export const ballotParamsSchema = z.object({
  params: z.object({
    id: uuid('ID de boleta'),
  }),
});

export const electionBallotParamsSchema = z.object({
  params: z.object({
    electionId: uuid('ID de elección'),
  }),
});

export const listBallotSchema = z.object({
  query: z.object({
    election_id: uuid('election_id'),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(100)
      .default(10),
  }),
});

export const createBallotSchema = z.object({
  body: z.object({
    election_id: uuid('ID de elección'),
    version: version.optional(),
    is_active: z.boolean().optional(),
  }),
});

export const updateBallotSchema = z.object({
  params: z.object({
    id: uuid('ID de boleta'),
  }),

  body: z
    .object({
      version: version.optional(),
      is_active: z.boolean().optional(),
    })
    .refine(
      (data) => Object.keys(data).length > 0,
      'Al menos un campo debe ser proporcionado',
    ),
});

export const validateCompletenessSchema = z.object({
  params: z.object({
    id: uuid('ID de boleta'),
  }),
});

export default {
  ballotParamsSchema,
  electionBallotParamsSchema,
  listBallotSchema,
  createBallotSchema,
  updateBallotSchema,
  validateCompletenessSchema,
};