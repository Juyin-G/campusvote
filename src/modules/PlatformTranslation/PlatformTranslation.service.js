//  src/modules/PlatformTranslation/PlatformTranslation.service.js

import * as translationRepository from './PlatformTranslation.repository.js';
import { prisma } from '../../database/prisma.js'; // Ajusta la ruta a tu instancia de Prisma
import { ApiError } from '../../shared/errors/ApiError.js';

const translatePrismaError = (err) => {
  if (err?.code === 'P2002') {
    return ApiError.conflict('Ya existe una traducción con esa clave (translation_key)');
  }
  if (err?.code === 'P2025') {
    return ApiError.notFound('La traducción solicitada no existe');
  }
  return err;
};

/**
 * Obtiene el diccionario de traducciones usando la función SQL optimizada.
 * Resuelve el fallback de locales (es-PE -> es -> default) directamente en la BD.
 */
export const getUiTranslations = async (locale = 'es-PE', category = null) => {
  try {
    // Prisma parametriza esto de forma segura, previniendo inyección SQL
    const result = await prisma.$queryRaw`
      SELECT get_ui_translations(${locale}, ${category}) as translations
    `;
    
    // El resultado viene como [{ translations: { "key": "valor" } }]
    return result[0]?.translations || {};
  } catch (err) {
    console.error('Error al obtener traducciones de la BD:', err);
    throw ApiError.internal('Error al procesar el diccionario de traducciones');
  }
};

/**
 * Obtiene el locale efectivo de un usuario (preferencia -> org default -> 'es-PE')
 */
export const getEffectiveLocale = async (userId) => {
  try {
    const result = await prisma.$queryRaw`
      SELECT get_effective_locale(${userId}::uuid) as locale
    `;
    
    return result[0]?.locale || 'es-PE';
  } catch (err) {
    console.error('Error al obtener locale efectivo:', err);
    throw ApiError.internal('Error al determinar el locale del usuario');
  }
};

/**
 * CRUD: Crear una nueva entrada de traducción
 */
export const createTranslation = async (body) => {
  const data = {
    translationKey: body.translation_key,
    category: body.category || 'general',
    values: body.values,
  };

  try {
    return await translationRepository.createTranslation(data);
  } catch (err) {
    throw translatePrismaError(err);
  }
};

/**
 * CRUD: Actualizar una entrada de traducción
 */
export const updateTranslation = async (id, body) => {
  const data = {};
  
  if (body.translation_key !== undefined) data.translationKey = body.translation_key;
  if (body.category !== undefined) data.category = body.category;
  if (body.values !== undefined) data.values = body.values;

  if (Object.keys(data).length === 0) {
    throw ApiError.badRequest('No se proporcionaron datos para actualizar');
  }

  try {
    return await translationRepository.updateTranslation(id, data);
  } catch (err) {
    throw translatePrismaError(err);
  }
};

/**
 * CRUD: Obtener una traducción por su ID
 */
export const getTranslationById = async (id) => {
  const translation = await translationRepository.findTranslationById(id);
  
  if (!translation) {
    throw ApiError.notFound('La traducción solicitada no existe');
  }
  
  return translation;
};

/**
 * CRUD: Eliminar una traducción
 */
export const deleteTranslation = async (id) => {
  try {
    await translationRepository.deleteTranslation(id);
    return { deleted: true };
  } catch (err) {
    throw translatePrismaError(err);
  }
};

export default {
  getUiTranslations,
  getEffectiveLocale,
  createTranslation,
  updateTranslation,
  getTranslationById,
  deleteTranslation,
};