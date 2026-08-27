// src/modulos/PlatformTranslation/PlatformTranslation.repository.js
// src/modules/PlatformTranslation/PlatformTranslation.repository.js
// S4-XX — Acceso a datos de traducciones de la plataforma vía Prisma.

import { prisma } from '../../database/prisma.js'; // Ajusta la ruta si es necesario

/**
 * ⚠️ IMPORTANTE: Prisma Client usa los nombres de campo en camelCase (definidos en el modelo),
 * NO los nombres mapeados a la BD con @map (snake_case).
 * El modelo se llama 'platformTranslation' (singular).
 */
const TRANSLATION_SELECT = {
  id: true,
  translationKey: true,   // No 'translation_key'
  category: true,
  values: true,           // Prisma maneja esto como Json/JSONB
  createdAt: true,        // No 'created_at'
  updatedAt: true,        // No 'updated_at'
};

/**
 * Busca una traducción por su ID interno.
 */
export const findTranslationById = (id) =>
  prisma.platformTranslation.findUnique({
    where: { id },
    select: TRANSLATION_SELECT,
  });

/**
 * Busca una traducción por su clave única (translation_key).
 * Útil para validaciones rápidas de duplicados.
 */
export const findTranslationByKey = (translationKey) =>
  prisma.platformTranslation.findUnique({
    where: { translationKey },
    select: TRANSLATION_SELECT,
  });

/**
 * Lista todas las traducciones (opcionalmente filtradas por categoría).
 * Útil para paneles de administración.
 */
export const listTranslations = (filters = {}) => {
  const where = {};
  if (filters.category) {
    where.category = filters.category;
  }

  return prisma.platformTranslation.findMany({
    where,
    select: TRANSLATION_SELECT,
    orderBy: { category: 'asc' },
  });
};

/**
 * Crea una nueva entrada de traducción en el diccionario.
 */
export const createTranslation = (data) =>
  prisma.platformTranslation.create({
    data,
    select: TRANSLATION_SELECT,
  });

/**
 * Actualiza una entrada de traducción existente.
 */
export const updateTranslation = (id, data) =>
  prisma.platformTranslation.update({
    where: { id },
    data,
    select: TRANSLATION_SELECT,
  });

/**
 * Elimina una entrada de traducción por su ID.
 */
export const deleteTranslation = (id) =>
  prisma.platformTranslation.delete({
    where: { id },
    select: { id: true },
  });

export default {
  findTranslationById,
  findTranslationByKey,
  listTranslations,
  createTranslation,
  updateTranslation,
  deleteTranslation,
};