// src/modules/results/results.schema.js
// S7-11 — Schemas Zod para validación de entradas en Results.

import { z } from 'zod';

export const electionIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid('ID de elección inválido'),
    electionId: z.string().uuid('ID de elección inválido').optional(),
  }),
});

export const liveResultsQuerySchema = z.object({
  query: z.object({
    election_id: z.string().uuid('ID de elección inválido'),
  }),
});

export const finalResultsQuerySchema = liveResultsQuerySchema;
