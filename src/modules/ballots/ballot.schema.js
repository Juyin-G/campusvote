// src/modules/ballots/ballot.schema.js

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
    electionId: uuid('ID de elección').optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
  }),
});

export const createBallotSchema = z.object({
  body: z.object({
    electionId: uuid('ID de elección'),
  }),
});

export const updateBallotSchema = z.object({
  params: z.object({
    id: uuid('ID de boleta'),
  }),
  body: z
    .object({
      isActive: z.boolean().optional(),
    })
    .refine(
      (data) => Object.keys(data).length > 0,
      { message: 'Al menos un campo debe ser proporcionado' }
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