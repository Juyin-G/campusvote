// src/modules/ballots/ballotOption.schema.js
// S5-06 — Validaciones Zod de ballot_options.

import { z } from 'zod';

const uuid = (label) =>
  z.string().uuid(`${label} inválido`);

export const ballotOptionTypeEnum = z.enum([
  'CANDIDATE_LIST',
  'BLANK',
  'NULL',
]);

const label = z
  .string()
  .max(120, 'Como máximo 120 caracteres')
  .refine(
    (value) => value.trim().length > 0,
    'La etiqueta no puede estar vacía',
  );

export const listBallotOptionSchema = z.object({
  params: z.object({
    ballotPositionId: uuid('ID de posición de boleta'),
  }),
});

export const ballotOptionParamsSchema = z.object({
  params: z.object({
    ballotPositionId: uuid('ID de posición de boleta'),
    id: uuid('ID de opción de boleta'),
  }),
});

export const createBallotOptionSchema = z.object({
  params: z.object({
    ballotPositionId: uuid('ID de posición de boleta'),
  }),

  body: z
    .object({
      option_type: ballotOptionTypeEnum.default('CANDIDATE_LIST'),

      candidate_list_id: uuid('ID de lista candidata')
        .nullable()
        .optional(),

      label,
    })
    .superRefine((data, ctx) => {
      if (
        data.option_type === 'CANDIDATE_LIST' &&
        !data.candidate_list_id
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['candidate_list_id'],
          message:
            'candidate_list_id es obligatorio para CANDIDATE_LIST',
        });
      }

      if (
        ['BLANK', 'NULL'].includes(data.option_type) &&
        data.candidate_list_id
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['candidate_list_id'],
          message:
            'BLANK y NULL no deben tener candidate_list_id',
        });
      }
    }),
});

export const updateBallotOptionSchema = z.object({
  params: z.object({
    ballotPositionId: uuid('ID de posición de boleta'),
    id: uuid('ID de opción de boleta'),
  }),

  body: z
    .object({
      option_type: ballotOptionTypeEnum.optional(),

      candidate_list_id: uuid('ID de lista candidata')
        .nullable()
        .optional(),

      label: label.optional(),
    })
    .refine(
      (data) => Object.keys(data).length > 0,
      'Al menos un campo debe ser proporcionado',
    ),
});

export default {
  ballotOptionTypeEnum,
  listBallotOptionSchema,
  ballotOptionParamsSchema,
  createBallotOptionSchema,
  updateBallotOptionSchema,
};