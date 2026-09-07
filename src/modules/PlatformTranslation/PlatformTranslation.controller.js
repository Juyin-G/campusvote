// src/modules/PlatformTranslation/PlatformTranslation.controller.js

import * as translationService from './PlatformTranslation.service.js';
import asyncHandler from '../../shared/utils/asyncHandler.js';
import { sendSuccess } from '../../shared/utils/apiResponse.js';
import { HTTP_STATUS } from '../../constants/httpStatus.js';

/**
 * Obtener el diccionario de traducciones (Optimizado con función SQL)
 * @route GET /api/platform/translations/dictionary
 * @access Público o Autenticado (según tu necesidad)
 */
export const getDictionary = asyncHandler(async (req, res) => {
  const { locale, category } = req.query;

  const translations = await translationService.getUiTranslations(locale, category);

  return sendSuccess(
    res,
    translations,
    'Diccionario de traducciones obtenido exitosamente',
    { requestId: req.requestId },
    HTTP_STATUS.OK
  );
});

/**
 * Obtener el locale efectivo de un usuario específico
 * @route GET /api/platform/translations/effective-locale/:userId
 * @access ADMIN
 */
export const getEffectiveLocale = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const locale = await translationService.getEffectiveLocale(userId);

  return sendSuccess(
    res,
    { locale },
    'Locale efectivo obtenido',
    { requestId: req.requestId },
    HTTP_STATUS.OK
  );
});

/**
 * Listar todas las traducciones (Para panel de administración)
 * @route GET /api/platform/translations
 * @access ADMIN
 */
export const listTranslations = asyncHandler(async (req, res) => {
  const { category } = req.query;

  const translations = await translationService.listTranslations({ category });

  return sendSuccess(
    res,
    translations,
    'Consulta exitosa',
    { requestId: req.requestId, total: translations.length },
    HTTP_STATUS.OK
  );
});

/**
 * Obtener una traducción específica por su ID
 * @route GET /api/platform/translations/:id
 * @access ADMIN
 */
export const getTranslationById = asyncHandler(async (req, res) => {
  const translation = await translationService.getTranslationById(req.params.id);

  return sendSuccess(
    res,
    translation,
    'Consulta exitosa',
    { requestId: req.requestId },
    HTTP_STATUS.OK
  );
});

/**
 * Crear una nueva entrada en el diccionario de traducciones
 * @route POST /api/platform/translations
 * @access ADMIN
 */
export const createTranslation = asyncHandler(async (req, res) => {
  const translation = await translationService.createTranslation(req.body);

  return sendSuccess(
    res,
    translation,
    'Traducción creada correctamente',
    { requestId: req.requestId },
    HTTP_STATUS.CREATED
  );
});

/**
 * Actualizar parcialmente una traducción existente
 * @route PATCH /api/platform/translations/:id
 * @access ADMIN
 */
export const updateTranslation = asyncHandler(async (req, res) => {
  const translation = await translationService.updateTranslation(req.params.id, req.body);

  return sendSuccess(
    res,
    translation,
    'Traducción actualizada correctamente',
    { requestId: req.requestId },
    HTTP_STATUS.OK
  );
});

/**
 * Eliminar una traducción del diccionario
 * @route DELETE /api/platform/translations/:id
 * @access ADMIN
 */
export const deleteTranslation = asyncHandler(async (req, res) => {
  await translationService.deleteTranslation(req.params.id);

  return sendSuccess(
    res,
    { deleted: true },
    'Traducción eliminada correctamente',
    { requestId: req.requestId },
    HTTP_STATUS.OK
  );
});

export default {
  getDictionary,
  getEffectiveLocale,
  listTranslations,
  getTranslationById,
  createTranslation,
  updateTranslation,
  deleteTranslation,
};