/**
 * Candidacy Controller
 * Capa HTTP: recibe request, delega a candidacy.service, responde JSON.
 *
 * S4-08 — CRUD de candidaturas.
 * Rutas anidadas bajo /api/elections/:electionId/candidacies.
 */
import * as candidacyService from './candidacy.service.js';
import asyncHandler from '../../shared/utils/asyncHandler.js';
import { sendSuccess } from '../../shared/utils/apiResponse.js';
import { HTTP_STATUS } from '../../constants/httpStatus.js';
import MESSAGES from '../../constants/messages.js';

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

  // Sin paginar a propósito: la papeleta necesita la nómina completa.
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
 * Registrar una candidatura (solo con la elección en DRAFT)
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
 * Actualizar una candidatura (solo con la elección en DRAFT)
 * @route PUT /api/elections/:electionId/candidacies/:id
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
 * Retirar una candidatura (solo con la elección en DRAFT)
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
