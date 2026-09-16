// src/modules/elections/electionRules/electionRules.controller.js

import * as electionRulesService from './electionRules.service.js';
import asyncHandler from '../../../shared/utils/asyncHandler.js';
import { sendSuccess } from '../../../shared/utils/apiResponse.js';
import { HTTP_STATUS } from '../../../constants/httpStatus.js';

/**
 * Obtener las reglas de una elección
 * @route GET /api/elections/:electionId/rules
 * @access Autenticado
 */
export const getRules = asyncHandler(async (req, res) => {
  const rules = await electionRulesService.getRules(req.params.electionId);

  return sendSuccess(
    res,
    rules,
    'Consulta exitosa',
    { requestId: req.requestId },
    HTTP_STATUS.OK
  );
});

/**
 * Configurar las reglas de una elección (solo en DRAFT/SCHEDULED, una sola vez)
 * @route POST /api/elections/:electionId/rules
 * @access ADMIN
 */
export const createRules = asyncHandler(async (req, res) => {
  const rules = await electionRulesService.createRules(
    req.params.electionId,
    req.body
  );

  return sendSuccess(
    res,
    rules,
    'Reglas de la elección configuradas correctamente.',
    { requestId: req.requestId },
    HTTP_STATUS.CREATED
  );
});

/**
 * Modificar parcialmente las reglas de una elección (solo en DRAFT/SCHEDULED)
 * @route PATCH /api/elections/:electionId/rules
 * @access ADMIN
 */
export const updateRules = asyncHandler(async (req, res) => {
  const rules = await electionRulesService.updateRules(
    req.params.electionId,
    req.body
  );

  return sendSuccess(
    res,
    rules,
    'Reglas de la elección actualizadas correctamente.',
    { requestId: req.requestId },
    HTTP_STATUS.OK
  );
});

/**
 * Eliminar las reglas de una elección (vuelve a los valores por defecto de la BD)
 * @route DELETE /api/elections/:electionId/rules
 * @access ADMIN
 */
export const deleteRules = asyncHandler(async (req, res) => {
  const result = await electionRulesService.deleteRules(req.params.electionId);

  return sendSuccess(
    res,
    result,
    'Reglas de la elección eliminadas correctamente.',
    { requestId: req.requestId },
    HTTP_STATUS.OK
  );
});