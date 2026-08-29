// src/modules/elections/elections/election.controller.js
import * as electionService from './election.service.js';
import asyncHandler from '../../../shared/utils/asyncHandler.js';
import { sendSuccess, sendPaginated } from '../../../shared/utils/apiResponse.js';
import { HTTP_STATUS } from '../../../constants/httpStatus.js';
import MESSAGES from '../../../constants/messages.js';

// El JWT se firma con userId; se acepta id como respaldo (igual que en users)
const actorId = (user) => user?.userId ?? user?.id;

// Mensajes específicos por estado alcanzado
const STATUS_MESSAGES = {
  OPEN: MESSAGES.ELECTION.OPENED_SUCCESS,
  CLOSED: MESSAGES.ELECTION.CLOSED_SUCCESS,
};

/**
 * Listar elecciones paginadas
 * @route GET /api/elections
 * @access Autenticado
 */
export const listElections = asyncHandler(async (req, res) => {
  const { elections, pagination } = await electionService.listElections(req.query);

  return sendPaginated(res, elections, pagination, 'Consulta exitosa');
});

/**
 * Obtener una elección por ID
 * @route GET /api/elections/:id
 * @access Autenticado
 */
export const getElectionById = asyncHandler(async (req, res) => {
  const election = await electionService.getElectionById(req.params.id);

  return sendSuccess(
    res,
    election,
    'Consulta exitosa',
    { requestId: req.requestId },
    HTTP_STATUS.OK
  );
});

/**
 * Crear una nueva elección (nace en estado DRAFT)
 * @route POST /api/elections
 * @access ADMIN, ELECTORAL_COMMISSION
 */
export const createElection = asyncHandler(async (req, res) => {
  const election = await electionService.createElection(
    req.body,
    actorId(req.user)
  );

  return sendSuccess(
    res,
    election,
    MESSAGES.ELECTION.CREATED_SUCCESS,
    { requestId: req.requestId },
    HTTP_STATUS.CREATED
  );
});

/**
 * Actualizar una elección parcialmente (solo en estado DRAFT/SCHEDULED)
 * @route PATCH /api/elections/:id
 * @access ADMIN, ELECTORAL_COMMISSION
 */
export const updateElection = asyncHandler(async (req, res) => {
  const election = await electionService.updateElection(
    req.params.id,
    req.body
  );

  return sendSuccess(
    res,
    election,
    MESSAGES.ELECTION.UPDATED_SUCCESS,
    { requestId: req.requestId },
    HTTP_STATUS.OK
  );
});

/**
 * Eliminar una elección (solo en estado DRAFT/SCHEDULED)
 * @route DELETE /api/elections/:id
 * @access ADMIN, ELECTORAL_COMMISSION
 */
export const deleteElection = asyncHandler(async (req, res) => {
  const result = await electionService.deleteElection(req.params.id);

  return sendSuccess(
    res,
    result,
    MESSAGES.ELECTION.DELETED_SUCCESS,
    { requestId: req.requestId },
    HTTP_STATUS.OK
  );
});

/**
 * Avanzar la elección al siguiente estado del workflow
 * @route PATCH /api/elections/:id/status
 * @access ADMIN, ELECTORAL_COMMISSION
 */
export const changeStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const election = await electionService.changeStatus(
    req.params.id,
    status,
    req.user?.userId ?? req.user?.id
  );

  const message =
    STATUS_MESSAGES[status] || `Elección actualizada al estado ${status}`;

  return sendSuccess(
    res,
    election,
    message,
    { requestId: req.requestId },
    HTTP_STATUS.OK
  );
});