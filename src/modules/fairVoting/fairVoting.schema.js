// src/modules/fairVoting/fairVoting.schema.js
// Validación (Zod) con envelope { params, query, body }.

import { z } from 'zod';

const uuid = (label = 'ID') => z.string().uuid(`${label} debe ser un UUID válido`);

const fairParam = z.object({ fairId: uuid('El ID de la feria') });

// POST /api/fairs/:fairId/votes
export const castVoteSchema = z.object({
  params: fairParam,
  body: z
    .object({
      project_id: uuid('El ID del proyecto'),
    })
    .strict(),
});

// GET /api/fairs/:fairId/voting/status
export const votingStatusSchema = z.object({ params: fairParam });

// GET /api/fairs/:fairId/voting/results
export const votingResultsSchema = z.object({
  params: fairParam,
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
});

// GET /api/fairs/:fairId/voting/verify/:receiptCode (público, opcional)
export const verifyReceiptSchema = z.object({
  params: z.object({
    fairId: uuid('El ID de la feria'),
    receiptCode: z
      .string()
      .regex(/^[a-fA-F0-9]{16,64}$/, 'El comprobante tiene un formato inválido'),
  }),
});

export default {
  castVoteSchema,
  votingStatusSchema,
  votingResultsSchema,
  verifyReceiptSchema,
};
