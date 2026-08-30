// src/modules/ratings/rating.schema.js
// Validación Zod para la calificación por estrellas (jurados → proyectos).

import { z } from 'zod';

const uuid = (label = 'ID') => z.string().uuid(`${label} inválido`);

// Body para crear/actualizar una calificación de un jurado a un proyecto.
export const rateProjectSchema = z.object({
  body: z
    .object({
      score: z
        .number()
        .int('La calificación debe ser un entero')
        .min(1, 'La calificación mínima es 1 estrella')
        .max(5, 'La calificación máxima es 5 estrellas'),
      comment: z
        .string()
        .max(2000, 'El comentario no puede superar los 2000 caracteres')
        .trim()
        .optional()
        .nullable(),
    })
    .strict(),
  params: z.object({
    id: uuid('ID de la elección'),
    candidacyId: uuid('ID de la candidatura/proyecto'),
  }),
});

// Params para ver el detalle de una elección (resultados con promedio).
export const electionIdParamSchema = z.object({
  params: z.object({
    id: uuid('ID de la elección'),
  }),
});

// Params para listar calificaciones de una elección.
export const listRatingsSchema = z.object({
  params: z.object({
    id: uuid('ID de la elección'),
  }),
  query: z.object({
    candidacyId: z.string().uuid('ID de la candidatura inválido').optional(),
    limit: z
      .string()
      .regex(/^\d+$/, 'limit debe ser un número')
      .transform((v) => parseInt(v, 10))
      .refine((v) => v >= 1 && v <= 200, { message: 'limit entre 1 y 200' })
      .optional(),
    offset: z
      .string()
      .regex(/^\d+$/, 'offset debe ser un número')
      .transform((v) => parseInt(v, 10))
      .refine((v) => v >= 0, { message: 'offset debe ser >= 0' })
      .optional(),
  }),
});
