/**
 * Position Controller
 * Capa HTTP: recibe request, delega a position.service, responde JSON.
 *
 * S4-04 — CRUD de cargos por elección.
 * Todas las rutas van anidadas bajo /api/elections/:electionId/positions,
 * porque un cargo no existe fuera de su elección.
 */
import * as positionService from './position.service.js';
import asyncHandler from '../../shared/utils/asyncHandler.js';
import { sendSuccess } from '../../shared/utils/apiResponse.js';
import { HTTP_STATUS } from '../../constants/httpStatus.js';

/**
 * Listar los cargos de una elección
 * @route GET /api/elections/:electionId/positions
 * @access Autenticado
 */
export const listPositions = asyncHandler(async (req, res) => {
  const { positions, total } = await positionService.listPositions(
    req.params.electionId
  );

  // Sin paginar a propósito: la papeleta necesita SIEMPRE todos los cargos,
  // y paginarlos haría que un cliente pudiera construirla incompleta.
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
 * Crear un cargo (solo con la elección en DRAFT)
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
 * Actualizar un cargo (solo con la elección en DRAFT)
 * @route PUT /api/elections/:electionId/positions/:id
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
 * Eliminar un cargo (solo con la elección en DRAFT y sin candidaturas)
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
