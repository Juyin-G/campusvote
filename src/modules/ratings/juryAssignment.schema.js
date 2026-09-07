// src/modules/ratings/juryAssignment.schema.js
// Validación Zod para asignación de jurados (doble ciego + conflicto de interés).

import { z } from 'zod';

const uuid = (label = 'ID') => z.string().uuid(`${label} inválido`);

export const assignJurySchema = z.object({
  params: z.object({
    id: uuid('ID de la elección'),
  }),
  body: z
    .object({
      jury_id: uuid('ID del jurado'),
      candidacy_id: uuid('ID del proyecto'),
      is_diriment: z.boolean().optional().default(false),
    })
    .strict(),
});

export const approveJurySchema = z.object({
  params: z.object({
    id: uuid('ID de la elección'),
    assignmentId: uuid('ID de la asignación'),
  }),
  body: z
    .object({
      status: z.enum(['APPROVED', 'REJECTED']),
    })
    .strict(),
});

export const signConflictSchema = z.object({
  params: z.object({
    id: uuid('ID de la elección'),
    assignmentId: uuid('ID de la asignación'),
  }),
  body: z
    .object({
      declared: z
        .literal(true, { errorMap: () => ({ message: 'Debes confirmar con declared: true' }) }),
    })
    .strict(),
});

export const listAssignmentsSchema = z.object({
  params: z.object({
    id: uuid('ID de la elección'),
  }),
  query: z.object({
    candidacyId: z.string().uuid('ID de la candidatura inválido').optional(),
    status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
  }),
});