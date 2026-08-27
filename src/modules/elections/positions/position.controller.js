// src/modules/elections/positions/position.controller.js

import * as positionService from './position.service.js';
import asyncHandler from '../../../shared/utils/asyncHandler.js';
import { sendSuccess } from '../../../shared/utils/apiResponse.js';
import { HTTP_STATUS } from '../../../constants/httpStatus.js';

/**
 * Listar los cargos de una elección
 * @route GET /api/elections/:electionId/positions
 * @access Autenticado
 */
export const listPositions = asyncHandler(async (req, res) => {
  const { positions, total } = await positionService.listPositions(req.params.electionId);

  // Sin paginar a propósito: la papeleta necesita SIEMPRE todos los cargos.
  return sendSuccess(
    res,
    positions,
    'Consulta exitosa',
    { requestId: req.requestId, total },
    HTTP_STATUS.OK
  );
});

/**
 * Obtener un cargo por ID
 * @route GET /api/elections/:electionId/positions/:id
 * @access Autenticado
 */
export const getPositionById = asyncHandler(async (req, res) => {
  const position = await positionService.getPositionById(
    req.params.electionId,
    req.params.id
  );

  return sendSuccess(
    res,
    position,
    'Consulta exitosa',
    { requestId: req.requestId },
    HTTP_STATUS.OK
  );
});

/**
 * Crear un cargo (solo con la elección en DRAFT/SCHEDULED)
 * @route POST /api/elections/:electionId/positions
 * @access ADMIN, ELECTORAL_COMMISSION
 */
export const createPosition = asyncHandler(async (req, res) => {
  const position = await positionService.createPosition(
    req.params.electionId,
    req.body
  );

  return sendSuccess(
    res,
    position,
    'Cargo creado correctamente.',
    { requestId: req.requestId },
    HTTP_STATUS.CREATED
  );
});

/**
 * Actualizar parcialmente un cargo (solo con la elección en DRAFT/SCHEDULED)
 * @route PATCH /api/elections/:electionId/positions/:id
 * @access ADMIN, ELECTORAL_COMMISSION
 */
export const updatePosition = asyncHandler(async (req, res) => {
  const position = await positionService.updatePosition(
    req.params.electionId,
    req.params.id,
    req.body
  );

  return sendSuccess(
    res,
    position,
    'Cargo actualizado correctamente.',
    { requestId: req.requestId },
    HTTP_STATUS.OK
  );
});

/**
 * Eliminar un cargo (solo en DRAFT/SCHEDULED y sin candidaturas asociadas)
 * @route DELETE /api/elections/:electionId/positions/:id
 * @access ADMIN, ELECTORAL_COMMISSION
 */
export const deletePosition = asyncHandler(async (req, res) => {
  const result = await positionService.deletePosition(
    req.params.electionId,
    req.params.id
  );

  return sendSuccess(
    res,
    result,
    'Cargo eliminado correctamente.',
    { requestId: req.requestId },
    HTTP_STATUS.OK
  );
});