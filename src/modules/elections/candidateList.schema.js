// src/modules/elections/candidateList.schema.js
// S4-07 — Validación Zod de listas candidatas.
// Refleja los CHECK de la tabla `candidate_lists`.

import { z } from 'zod';

const uuid = (label) => z.string().uuid(`${label} inválido`);

// chk_candidate_lists_name_not_empty: length(trim(name)) > 0, VARCHAR(120)
const listName = z
  .string()
  .max(120, 'Como máximo 120 caracteres')
  .refine((value) => value.trim().length > 0, 'El nombre de la lista no puede estar vacío');

/**
 * acronym y motto admiten NULL, pero NO cadena vacía:
 *   CHECK (acronym IS NULL OR length(trim(acronym)) > 0)
 * Aquí se acepta '' para que el cliente pueda limpiar el campo;
 * el service lo convierte a null antes de tocar la BD.
 */
const optionalText = (max) =>
  z.string().max(max, `Como máximo ${max} caracteres`).nullable().optional();

/** /api/elections/:electionId/candidate-lists */
export const listCandidateListSchema = z.object({
  params: z.object({
    electionId: uuid('ID de elección'),
  }),
});

/** /api/elections/:electionId/candidate-lists/:id */
export const candidateListParamsSchema = z.object({
  params: z.object({
    electionId: uuid('ID de elección'),
    id: uuid('ID de lista'),
  }),
});

export const createCandidateListSchema = z.object({
  params: z.object({
    electionId: uuid('ID de elección'),
  }),
  body: z.object({
    name: listName,
    acronym: optionalText(20),
    motto: optionalText(255),
    logo: optionalText(500),
  }),
});

export const updateCandidateListSchema = z.object({
  params: z.object({
    electionId: uuid('ID de elección'),
    id: uuid('ID de lista'),
  }),
  body: z
    .object({
      name: listName.optional(),
      acronym: optionalText(20),
      motto: optionalText(255),
      logo: optionalText(500),
    })
    .refine(
      (data) => Object.keys(data).length > 0,
      'Al menos un campo debe ser proporcionado'
    ),
});
