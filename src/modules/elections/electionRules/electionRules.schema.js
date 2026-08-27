// src/modules/elections/electionRules/electionRules.schema.js
// S4-11 — Validación Zod de reglas de elección.
// Refleja los CHECK de la tabla `election_rules`.

import { z } from 'zod';

const uuid = (label) => z.string().uuid(`${label} inválido`);

const turnoutPercentage = z.coerce
  .number()
  .min(0, 'El quórum mínimo no puede ser negativo')
  .max(100, 'El quórum mínimo no puede superar 100')
  .refine(
    (value) => Number(value.toFixed(2)) === value,
    'El quórum admite como máximo 2 decimales'
  );

const maxVotesPerPosition = z.coerce
  .number()
  .int('Debe ser un número entero')
  .min(1, 'Debe permitirse al menos 1 voto por cargo')
  .max(32767, 'Excede el máximo permitido de SMALLINT');

/** Todos los campos son opcionales: la BD ya define valores por defecto. */
const rulesBody = {
  min_turnout_percentage: turnoutPercentage.optional(),
  allow_blank_vote: z.boolean().optional(),
  allow_null_vote: z.boolean().optional(),
  max_votes_per_position: maxVotesPerPosition.optional(), // ⚠️ CORRECCIÓN
  requires_2fa: z.boolean().optional(),
};

/** /api/elections/:electionId/rules */
export const electionRulesParamsSchema = z.object({
  params: z.object({
    electionId: uuid('ID de elección'),
  }),
});

export const createElectionRulesSchema = z.object({
  params: z.object({
    electionId: uuid('ID de elección'),
  }),
  body: z.object(rulesBody),
});

export const updateElectionRulesSchema = z.object({
  params: z.object({
    electionId: uuid('ID de elección'),
  }),
  body: z
    .object(rulesBody)
    .refine(
      (data) => Object.keys(data).length > 0,
      'Al menos un campo debe ser proporcionado'
    ),
});