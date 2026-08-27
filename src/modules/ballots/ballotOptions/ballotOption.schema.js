// src/modules/ballots/ballotOption.schema.js

import { z } from 'zod';

const uuid = (label) =>
  z.string().uuid(`${label} inválido`);

export const ballotOptionTypeEnum = z.enum([
  'CANDIDATE_LIST',
  'BLANK',
  'VOID',
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
      optionType: ballotOptionTypeEnum.optional(),
      option_type: ballotOptionTypeEnum.optional(),

      candidateListId: uuid('ID de lista candidata')
        .nullable()
        .optional(),
      candidate_list_id: uuid('ID de lista candidata')
        .nullable()
        .optional(),

      label,
    })
    .superRefine((data, ctx) => {
      const optionType = data.optionType || data.option_type || 'CANDIDATE_LIST';
      const candidateListId = data.candidateListId ?? data.candidate_list_id;

      if (optionType === 'CANDIDATE_LIST' && !candidateListId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [data.candidateListId !== undefined ? 'candidateListId' : 'candidate_list_id'],
          message: 'candidateListId es obligatorio para CANDIDATE_LIST',
        });
      }

      if (['BLANK', 'VOID'].includes(optionType) && candidateListId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [data.candidateListId !== undefined ? 'candidateListId' : 'candidate_list_id'],
          message: 'BLANK y VOID no deben tener candidateListId',
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
      optionType: ballotOptionTypeEnum.optional(),
      option_type: ballotOptionTypeEnum.optional(),

      candidateListId: uuid('ID de lista candidata')
        .nullable()
        .optional(),
      candidate_list_id: uuid('ID de lista candidata')
        .nullable()
        .optional(),

      label: label.optional(),
    })
    .refine(
      (data) => Object.keys(data).length > 0,
      { message: 'Al menos un campo debe ser proporcionado' },
    ),
});

export default {
  ballotOptionTypeEnum,
  listBallotOptionSchema,
  ballotOptionParamsSchema,
  createBallotOptionSchema,
  updateBallotOptionSchema,
};