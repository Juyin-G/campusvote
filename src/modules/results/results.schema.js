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

// F2: certificación ponderada por estamento (Ley Universitaria peruana).
// Si no se envían pesos, se toman de election_rules.
export const certifyWeightedSchema = z
  .object({
    params: z.object({
      id: z.string().uuid('ID de elección inválido'),
    }),
    body: z
      .object({
        teacher_weight: z.number().min(0).max(1).optional(),
        student_weight: z.number().min(0).max(1).optional(),
        min_teacher_turnout: z.number().min(0).max(100).optional(),
        min_student_turnout: z.number().min(0).max(100).optional(),
        quorum_fail_policy: z
          .enum(['VOID_ELECTION', 'VOID_STAKE', 'SECOND_ROUND'])
          .optional(),
      })
      .strict()
      .default({}),
  });

// F6: derivar ranking final de feria (jurados 80% + voto popular 20%).
export const finalizeFairSchema = z.object({
  params: z.object({
    id: z.string().uuid('ID de elección inválido'),
  }),
});
