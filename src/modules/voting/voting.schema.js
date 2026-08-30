// src/modules/voting/voting.schema.js

import { z } from 'zod';

const uuid = (label = 'ID') => z.string().uuid(`${label} inválido`);

/** Params y Body: /voting/elections/:electionId/sessions */
export const startSessionSchema = z.object({
  params: z.object({
    electionId: uuid('ID de elección'),
  }),
  body: z.object({
    votingToken: z.string().optional(), // Token de 1 solo uso para cabina/doble factor
  }).optional(),
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

/** Params: /public/verify-receipt/:receiptCode */
export const receiptParamsSchema = z.object({
  params: z.object({
    receiptCode: z
      .string({ required_error: 'El código de comprobante es requerido' })
      .min(1, 'El código de comprobante es requerido')
      .regex(/^[a-fA-F0-9]{8,128}$/, 'El código de comprobante tiene un formato inválido'),
  }),
});

export default {
  startSessionSchema,
  castVoteParamsSchema,
  castVoteBodySchema,
  getSessionParamsSchema,
  receiptParamsSchema,
};