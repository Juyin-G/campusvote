// src/modules/objections/objection.schema.js
// Validación Zod para tachas (SCHEDULED) e impugnaciones (CLOSED/CERTIFIED).

import { z } from 'zod';

const uuid = (label = 'ID') => z.string().uuid(`${label} inválido`);

export const fileObjectionSchema = z.object({
  params: z.object({
    id: uuid('ID de la elección'),
  }),
  body: z
    .object({
      objection_type: z.enum([
        'TACHA_LIST',
        'TACHA_CANDIDATE',
        'IMPUGNACION_VOTE',
        'IMPUGNACION_RESULT',
      ]),
      candidate_list_id: uuid('ID de la lista').optional(),
      candidacy_id: uuid('ID del candidato/proyecto').optional(),
      reason: z
        .string()
        .trim()
        .min(10, 'La razón debe tener al menos 10 caracteres')
        .max(4000, 'La razón no puede superar 4000 caracteres'),
      evidence_urls: z
        .array(z.string().url('Cada evidencia debe ser una URL'))
        .max(10, 'Máximo 10 evidencias')
        .optional()
        .default([]),
    })
    .refine((d) => (d.candidate_list_id !== undefined) !== (d.candidacy_id !== undefined), {
      message: 'Debes indicar exactamente un objetivo (candidate_list_id o candidacy_id)',
    }),
});

export const resolveObjectionSchema = z.object({
  params: z.object({
    id: uuid('ID de la elección'),
    objectionId: uuid('ID de la objeción'),
  }),
  body: z
    .object({
      status: z.enum(['FOUNDED', 'UNFOUNDED', 'WITHDRAWN']),
      resolution_notes: z
        .string()
        .trim()
        .min(5, 'Las notas de resolución deben tener al menos 5 caracteres')
        .max(4000, 'Las notas no pueden superar 4000 caracteres'),
    })
    .strict(),
});

export const listObjectionsSchema = z.object({
  params: z.object({
    id: uuid('ID de la elección'),
  }),
  query: z.object({
    status: z.enum(['PENDING', 'FOUNDED', 'UNFOUNDED', 'WITHDRAWN']).optional(),
    objection_type: z
      .enum(['TACHA_LIST', 'TACHA_CANDIDATE', 'IMPUGNACION_VOTE', 'IMPUGNACION_RESULT'])
      .optional(),
    limit: z.coerce.number().int('limit debe ser un número').min(1).max(200).optional(),
    offset: z.coerce.number().int('offset debe ser un número').min(0).optional(),
  }),
});