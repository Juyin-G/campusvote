// src/modules/voting/voting.schema.js
// Schemas Zod para validación del módulo de VOTACIÓN.

import { z } from 'zod';

const uuid = (label = 'ID') => z.string().uuid(`${label} inválido`);

/** Params: /voting/elections/:electionId/sessions */
export const startSessionParamsSchema = z.object({
  params: z.object({
    electionId: uuid('ID de elección'),
  }),
});

/** Params: /voting/sessions/:sessionId/cast */
export const castVoteParamsSchema = z.object({
  params: z.object({
    sessionId: uuid('ID de sesión'),
  }),
});

/** Body del voto: payload cifrado + hash + selecciones por cargo. */
export const castVoteBodySchema = z
  .object({
    encryptedPayload: z
      .string({ required_error: 'El payload cifrado del voto es requerido' })
      .min(1, 'El payload cifrado del voto es requerido'),
    payloadHash: z
      .string({ required_error: 'El hash del payload es requerido' })
      .min(1, 'El hash del payload es requerido'),
    selections: z
      .array(
        z.object({
          optionId: uuid('ID de opción'),
        })
      )
      .optional()
      .default([]),
  })
  .strict();

/** Params: /voting/sessions/:id */
export const getSessionParamsSchema = z.object({
  params: z.object({
    id: uuid('ID de sesión'),
  }),
});

export default {
  startSessionParamsSchema,
  castVoteParamsSchema,
  castVoteBodySchema,
  getSessionParamsSchema,
};
