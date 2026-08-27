// src/modules/elections/positions/position.service.js

import * as positionRepository from './position.repository.js';
import * as electionRepository from '../elections/election.repository.js'; 
import { ApiError } from '../../../shared/errors/ApiError.js';
import MESSAGES from '../../../constants/messages.js';

const EDITABLE_STATUSES = ['DRAFT', 'SCHEDULED'];

const asText = (value) => (typeof value === 'string' ? value.trim() : '');

const translatePrismaError = (err) => {
  if (err?.code === 'P2002') {
    return ApiError.conflict('Ya existe un cargo con ese nombre en esta elección');
  }
  if (err?.code === 'P2025') {
    return ApiError.notFound('El cargo solicitado no existe');
  }
  if (err?.code === 'P2003') {
    return ApiError.badRequest('La elección indicada no existe');
  }
  return err;
};

const requireElection = async (electionId) => {
  const election = await electionRepository.findElectionStatus(electionId);
  if (!election) throw ApiError.notFound(MESSAGES.ELECTION.NOT_FOUND);
  return election;
};

const requireDraftElection = async (electionId) => {
  const election = await requireElection(electionId);
  if (!EDITABLE_STATUSES.includes(election.status)) {
    throw ApiError.conflict(MESSAGES.ELECTION.DRAFT_ONLY_ACTION || 'La elección ya no es editable');
  }
  return election;
};

const requirePositionInElection = async (electionId, positionId) => {
  const position = await positionRepository.findPositionById(positionId);

  if (!position || position.electionId !== electionId) {
    throw ApiError.notFound('El cargo solicitado no existe en esta elección');
  }

  return position;
};

export const listPositions = async (electionId) => {
  await requireElection(electionId);
  const positions = await positionRepository.findPositionsByElection(electionId);
  return { positions, total: positions.length };
};

export const getPositionById = async (electionId, positionId) => {
  await requireElection(electionId);
  return requirePositionInElection(electionId, positionId);
};

export const createPosition = async (electionId, body = {}) => {
  await requireDraftElection(electionId);

  const data = {
    electionId: electionId,
    name: asText(body.name),
  };

  if (body.description !== undefined) {
    data.description = asText(body.description) || null;
  }
  if (body.seats !== undefined) {
    data.seats = Number(body.seats);
  }

  try {
    return await positionRepository.createPosition(data);
  } catch (err) {
    throw translatePrismaError(err);
  }
};

export const updatePosition = async (electionId, positionId, body = {}) => {
  await requireDraftElection(electionId);
  await requirePositionInElection(electionId, positionId);

  const data = {};

  if (body.name !== undefined) data.name = asText(body.name);
  if (body.description !== undefined) {
    data.description = asText(body.description) || null;
  }
  if (body.seats !== undefined) {
    data.seats = Number(body.seats);
  }

  if (Object.keys(data).length === 0) {
    throw ApiError.badRequest(MESSAGES.COMMON.BAD_REQUEST);
  }

  try {
    return await positionRepository.updatePosition(positionId, data);
  } catch (err) {
    throw translatePrismaError(err);
  }
};

export const deletePosition = async (electionId, positionId) => {
  await requireDraftElection(electionId);
  await requirePositionInElection(electionId, positionId);

  // ¡Excelente medida de seguridad! Evita el borrado en cascada accidental de candidaturas.
  const candidaturas = await positionRepository.countCandidaciesByPosition(positionId);

  if (candidaturas > 0) {
    throw ApiError.conflict(
      `No se puede eliminar el cargo: tiene ${candidaturas} candidatura(s) asociada(s). Retíralas primero.`
    );
  }

  try {
    await positionRepository.deletePositionById(positionId);
    return { deleted: true };
  } catch (err) {
    throw translatePrismaError(err);
  }
};

export default {
  listPositions,
  getPositionById,
  createPosition,
  updatePosition,
  deletePosition,
};