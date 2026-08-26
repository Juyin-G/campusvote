// src/modules/elections/electionRules.schema.js
// S4-11 — Validación Zod de reglas de elección.
// Refleja los CHECK de la tabla `election_rules`.

import { z } from 'zod';

const uuid = (label) => z.string().uuid(`${label} inválido`);

/**
 * chk_election_rules_turnout: entre 0 y 100.
 * La columna es NUMERIC(5,2), así que más de 2 decimales se perdería
 * por redondeo silencioso: mejor rechazarlo de forma explícita.
 */
const turnoutPercentage = z.coerce
  .number()
  .min(0, 'El quórum mínimo no puede ser negativo')
  .max(100, 'El quórum mínimo no puede superar 100')
  .refine(
    (value) => Number(value.toFixed(2)) === value,
    'El quórum admite como máximo 2 decimales'
  );

// chk_election_rules_max_positions: >= 1. La columna es SMALLINT.
const maxPositions = z.coerce
  .number()
  .int('Debe ser un número entero')
  .min(1, 'Debe permitirse al menos 1 cargo por papeleta')
  .max(32767, 'Excede el máximo permitido');

/** Todos los campos son opcionales: la BD ya define valores por defecto. */
const rulesBody = {
  min_turnout_percentage: turnoutPercentage.optional(),
  allow_blank_vote: z.boolean().optional(),
  allow_null_vote: z.boolean().optional(),
  max_positions_per_ballot: maxPositions.optional(),
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
