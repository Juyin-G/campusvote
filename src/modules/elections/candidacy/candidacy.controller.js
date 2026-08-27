// src/modules/elections/candidacy/candidacy.controller.js

import * as candidacyService from './candidacy.service.js';
import asyncHandler from '../../../shared/utils/asyncHandler.js';
import { sendSuccess } from '../../../shared/utils/apiResponse.js';
import { HTTP_STATUS } from '../../../constants/httpStatus.js';
import MESSAGES from '../../../constants/messages.js';

/**
 * Listar candidaturas de una elección (filtrables por lista o cargo)
 * @route GET /api/elections/:electionId/candidacies
 * @access Autenticado
 */
export const listCandidacies = asyncHandler(async (req, res) => {
  const { candidacies, total } = await candidacyService.listCandidacies(
    req.params.electionId,
    req.query
  );

  return sendSuccess(
    res,
    candidacies,
    'Consulta exitosa',
    { requestId: req.requestId, total },
    HTTP_STATUS.OK
  );
});

/**
 * Obtener una candidatura por ID
 * @route GET /api/elections/:electionId/candidacies/:id
 * @access Autenticado
 */
export const getCandidacyById = asyncHandler(async (req, res) => {
  const candidacy = await candidacyService.getCandidacyById(
    req.params.electionId,
    req.params.id
  );

  return sendSuccess(
    res,
    candidacy,
    'Consulta exitosa',
    { requestId: req.requestId },
    HTTP_STATUS.OK
  );
});

/**
 * Registrar una candidatura (solo en DRAFT/SCHEDULED)
 * @route POST /api/elections/:electionId/candidacies
 * @access ADMIN, ELECTORAL_COMMISSION
 */
export const createCandidacy = asyncHandler(async (req, res) => {
  const candidacy = await candidacyService.createCandidacy(
    req.params.electionId,
    req.body
  );

  return sendSuccess(
    res,
    candidacy,
    MESSAGES.CANDIDATE.CREATED_SUCCESS,
    { requestId: req.requestId },
    HTTP_STATUS.CREATED
  );
});

/**
 * Actualizar una candidatura parcialmente (solo en DRAFT/SCHEDULED)
 * @route PATCH /api/elections/:electionId/candidacies/:id
 * @access ADMIN, ELECTORAL_COMMISSION
 */
export const updateCandidacy = asyncHandler(async (req, res) => {
  const candidacy = await candidacyService.updateCandidacy(
    req.params.electionId,
    req.params.id,
    req.body
  );

  return sendSuccess(
    res,
    candidacy,
    MESSAGES.CANDIDATE.UPDATED_SUCCESS,
    { requestId: req.requestId },
    HTTP_STATUS.OK
  );
});

/**
 * Retirar una candidatura (solo en DRAFT/SCHEDULED)
 * @route DELETE /api/elections/:electionId/candidacies/:id
 * @access ADMIN, ELECTORAL_COMMISSION
 */
export const deleteCandidacy = asyncHandler(async (req, res) => {
  const result = await candidacyService.deleteCandidacy(
    req.params.electionId,
    req.params.id
  );

  return sendSuccess(
    res,
    result,
    MESSAGES.CANDIDATE.DELETED_SUCCESS,
    { requestId: req.requestId },
    HTTP_STATUS.OK
  );
});