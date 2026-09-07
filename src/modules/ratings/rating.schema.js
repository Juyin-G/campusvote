// src/modules/ratings/rating.schema.js
// Validación Zod para la calificación por rúbrica multicriterio en ferias
// (matriz de criterios CONCYTEC/OCDE ponderados; score final = Σ score·peso).

import { z } from 'zod';

const uuid = (label = 'ID') => z.string().uuid(`${label} inválido`);

// Crear un criterio de rúbrica para una feria (solo ADMIN/COMISIÓN).
export const createCriterionSchema = z.object({
  params: z.object({
    id: uuid('ID de la elección'),
  }),
  body: z
    .object({
      name: z
        .string()
        .trim()
        .min(1, 'El nombre del criterio es obligatorio')
        .max(120, 'El nombre no puede superar 120 caracteres'),
      weight: z
        .number()
        .min(0.01, 'El peso debe ser mayor a 0')
        .max(1, 'El peso no puede superar 1'),
      max_score: z.number().int().min(1).max(20).default(20),
    })
    .strict(),
});

export const listCriteriaSchema = z.object({
  params: z.object({
    id: uuid('ID de la elección'),
  }),
});

export const deleteCriterionSchema = z.object({
  params: z.object({
    id: uuid('ID de la elección'),
    criterionId: uuid('ID del criterio'),
  }),
});

const ratingDetail = z.object({
  criterion_id: uuid('ID del criterio'),
  score: z
    .number()
    .min(0, 'La nota por criterio no puede ser negativa')
    .max(20, 'La nota por criterio no puede superar 20'),
});

// Rúbrica completa por calificación: UNA nota por CADA criterio configurado.
export const rateProjectSchema = z.object({
  body: z
    .object({
      details: z.array(ratingDetail).min(1, 'Debes calificar al menos un criterio'),
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
    status: z.enum(['ACTIVE', 'REVOKED']).optional(),
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

// Revocación administrativa de una calificación (REVOKED).
export const revokeRatingSchema = z.object({
  params: z.object({
    id: uuid('ID de la elección'),
    ratingId: uuid('ID de la calificación'),
  }),
  body: z
    .object({
      reason: z
        .string()
        .trim()
        .min(1, 'El motivo de la revocación es obligatorio')
        .max(500, 'El motivo no puede superar 500 caracteres'),
    })
    .strict(),
});

// Reactivación de una calificación revocada (SOLO vía revisión administrativa).
export const restoreRatingSchema = z.object({
  params: z.object({
    id: uuid('ID de la elección'),
    ratingId: uuid('ID de la calificación'),
  }),
});
