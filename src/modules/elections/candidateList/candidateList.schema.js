// src/modules/elections/candidateList/candidateList.schema.js
import { z } from 'zod';

const uuid = (label) => z.string().uuid(`${label} inválido`);

const listName = z
  .string()
  .max(120, 'Como máximo 120 caracteres')
  .refine((value) => value.trim().length > 0, 'El nombre de la lista no puede estar vacío');

const optionalText = (max) =>
  z.string().max(max, `Como máximo ${max} caracteres`).nullable().optional();

// SCHEMA DE LISTA PURAMENTE ELECTORAL
export const listCandidateListSchema = z.object({
  params: z.object({
    electionId: uuid('ID de elección'),
  }),
  query: z.object({
    search: z.string().trim().max(120, 'La búsqueda no puede superar 120 caracteres').optional(),
    status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
    sortBy: z.enum(['name', 'createdAt']).optional(),
    limit: z.coerce.number().int('limit debe ser un número').min(1).max(200).optional(),
    offset: z.coerce.number().int('offset debe ser un número').min(0).optional(),
    from_date: z.string().refine((value) => !Number.isNaN(Date.parse(value)), 'from_date debe ser ISO 8601').optional(),
    to_date: z.string().refine((value) => !Number.isNaN(Date.parse(value)), 'to_date debe ser ISO 8601').optional(),
  }),
});

export const candidateListParamsSchema = z.object({
  params: z.object({
    electionId: uuid('ID de elección'),
    id: uuid('ID de lista'),
  }),
});

// ELIMINADOS: description, imageUrl, category, tags
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

// ELIMINADOS: description, imageUrl, category, tags
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