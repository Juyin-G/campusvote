// src/modules/elections/candidateList/candidateList.controller.js
import * as candidateListService from './candidateList.service.js';
import asyncHandler from '../../../shared/utils/asyncHandler.js';
import { sendSuccess } from '../../../shared/utils/apiResponse.js';
import { HTTP_STATUS } from '../../../constants/httpStatus.js';

/**
 * Listar los proyectos/listas credenciales de una elección con filtros de búsqueda.
 * @route GET /api/elections/:electionId/candidate-lists
 * @access Autenticado
 */
export const listCandidateLists = asyncHandler(async (req, res) => {
  const { data: candidateLists, pagination } = await candidateListService.listCandidateLists(
    req.params.electionId,
    req.query
  );
  const total = pagination.total;

  // Sin paginar a propósito: la papeleta necesita todas las listas.
  return sendSuccess(
    res,
    candidateLists,
    'Consulta exitosa',
    { requestId: req.requestId, total },
    HTTP_STATUS.OK
  );
});

/**
 * Obtener una lista candidata por ID
 * @route GET /api/elections/:electionId/candidate-lists/:id
 * @access Autenticado
 */
export const getCandidateListById = asyncHandler(async (req, res) => {
  const candidateList = await candidateListService.getCandidateListById(
    req.params.electionId,
    req.params.id
  );

  return sendSuccess(
    res,
    candidateList,
    'Consulta exitosa',
    { requestId: req.requestId },
    HTTP_STATUS.OK
  );
});

/**
 * Crear una lista candidata (solo con la elección en DRAFT)
 * @route POST /api/elections/:electionId/candidate-lists
 * @access ADMIN
 */
export const createCandidateList = asyncHandler(async (req, res) => {
  const candidateList = await candidateListService.createCandidateList(
    req.params.electionId,
    req.body
  );

  return sendSuccess(
    res,
    candidateList,
    'Lista candidata creada correctamente.',
    { requestId: req.requestId },
    HTTP_STATUS.CREATED
  );
});

/**
 * Actualizar una lista candidata (solo con la elección en DRAFT)
 * @route PUT /api/elections/:electionId/candidate-lists/:id
 * @access ADMIN
 */
export const updateCandidateList = asyncHandler(async (req, res) => {
  const candidateList = await candidateListService.updateCandidateList(
    req.params.electionId,
    req.params.id,
    req.body
  );

  return sendSuccess(
    res,
    candidateList,
    'Lista candidata actualizada correctamente.',
    { requestId: req.requestId },
    HTTP_STATUS.OK
  );
});

/**
 * Eliminar una lista candidata (solo en DRAFT y sin candidaturas)
 * @route DELETE /api/elections/:electionId/candidate-lists/:id
 * @access ADMIN
 */
export const deleteCandidateList = asyncHandler(async (req, res) => {
  const result = await candidateListService.deleteCandidateList(
    req.params.electionId,
    req.params.id
  );

  return sendSuccess(
    res,
    result,
    'Lista candidata eliminada correctamente.',
    { requestId: req.requestId },
    HTTP_STATUS.OK
  );
});
