// src/modules/elections/candidateList/candidateList.schema.js
import { z } from 'zod';

const uuid = (label) => z.string().uuid(`${label} inválido`);

const listName = z
  .string()
  .max(120, 'Como máximo 120 caracteres')
  .refine((value) => value.trim().length > 0, 'El nombre de la lista no puede estar vacío');

const optionalText = (max) =>
  z.string().max(max, `Como máximo ${max} caracteres`).nullable().optional();

export const listCandidateListSchema = z.object({
  params: z.object({
    electionId: uuid('ID de elección'),
  }),
});

// ⚠️ ESTA ES LA EXPORTACIÓN QUE ESTABA FALLANDO ⚠️
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