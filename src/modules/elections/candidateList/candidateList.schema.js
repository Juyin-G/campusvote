// src/modules/elections/candidateList/candidateList.schema.js
import { z } from 'zod';

const uuid = (label) => z.string().uuid(`${label} inválido`);

const listName = z
  .string()
  .max(120, 'Como máximo 120 caracteres')
  .refine((value) => value.trim().length > 0, 'El nombre de la lista no puede estar vacío');

const optionalText = (max) =>
  z.string().max(max, `Como máximo ${max} caracteres`).nullable().optional();

// Descripción larga de proyecto (TEXT en BD)
const descriptionField = z
  .string()
  .max(10000, 'La descripción no puede superar 10000 caracteres')
  .nullable()
  .optional();

// Etiquetas/búsqueda por tags (JSONB en BD)
const tagsField = z
  .array(
    z
      .string()
      .trim()
      .min(1, 'Un tag no puede estar vacío')
      .max(50, 'Cada tag puede tener como máximo 50 caracteres')
  )
  .max(20, 'Como máximo 20 tags')
  .nullable()
  .optional();

/**
 * GET /api/elections/:electionId/candidate-lists
 * Filtros de búsqueda por proyecto: search (nombre/acrónimo/descripción),
 * category, status de la candidatura, sortBy y paginación opcional.
 * `withRatings` adjunta el promedio de estrellas y último comentario de la feria.
 */
export const listCandidateListSchema = z.object({
  params: z.object({
    electionId: uuid('ID de elección'),
  }),
  query: z.object({
    search: z
      .string()
      .trim()
      .max(120, 'La búsqueda no puede superar 120 caracteres')
      .optional(),
    category: z.string().trim().max(80, 'La categoría no puede superar 80 caracteres').optional(),
    status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
    sortBy: z.enum(['name', 'createdAt', 'rating']).optional(),
    limit: z.coerce.number().int('limit debe ser un número').min(1).max(200).optional(),
    offset: z.coerce.number().int('offset debe ser un número').min(0).optional(),
    withRatings: z
      .enum(['true', 'false'])
      .optional()
      .transform((value) => value === 'true'),
    min_rating: z.coerce.number().min(0).max(20).optional(),
    max_rating: z.coerce.number().min(0).max(20).optional(),
    from_date: z.string().refine((value) => !Number.isNaN(Date.parse(value)), 'from_date debe ser ISO 8601').optional(),
    to_date: z.string().refine((value) => !Number.isNaN(Date.parse(value)), 'to_date debe ser ISO 8601').optional(),
  }),
});

// ESTA ES LA EXPORTACIÓN QUE ESTABA FALLANDO 
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
    description: descriptionField,
    imageUrl: optionalText(1000),
    category: optionalText(80),
    tags: tagsField,
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
      description: descriptionField,
      imageUrl: optionalText(1000),
      category: optionalText(80),
      tags: tagsField,
    })
    .refine(
      (data) => Object.keys(data).length > 0,
      'Al menos un campo debe ser proporcionado'
    ),
});