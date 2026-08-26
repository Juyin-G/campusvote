// src/modules/elections/position.service.js
// S4-04 — Lógica de negocio de cargos (positions) dentro de una elección.

import * as positionRepository from './position.repository.js';
import * as electionRepository from './election.repository.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import MESSAGES from '../../constants/messages.js';

/** La estructura de la papeleta solo puede tocarse mientras sea borrador. */
const EDITABLE_STATUSES = ['DRAFT'];

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

/** La elección debe existir; devuelve su estado. */
const requireElection = async (electionId) => {
  const election = await electionRepository.findElectionStatus(electionId);

  if (!election) throw ApiError.notFound(MESSAGES.ELECTION.NOT_FOUND);

  return election;
};

/** Para crear, editar o borrar cargos la elección debe seguir en DRAFT. */
const requireDraftElection = async (electionId) => {
  const election = await requireElection(electionId);

  if (!EDITABLE_STATUSES.includes(election.status)) {
    throw ApiError.conflict(MESSAGES.ELECTION.DRAFT_ONLY_ACTION);
  }

  return election;
};

/**
 * Carga el cargo y verifica que pertenezca a esa elección.
 * Sin esta comprobación, conociendo un id se podría leer o modificar
 * un cargo de otra elección a través de una ruta anidada.
 */
const requirePositionInElection = async (electionId, positionId) => {
  const position = await positionRepository.findPositionById(positionId);

  if (!position || position.election_id !== electionId) {
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
    election_id: electionId,
    name: asText(body.name),
  };

  if (body.description !== undefined) {
    data.description = asText(body.description) || null;
  }
  if (body.seats !== undefined) data.seats = Number(body.seats);

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
  if (body.seats !== undefined) data.seats = Number(body.seats);

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

  // La FK de candidacies es ON DELETE CASCADE: borrar el cargo se llevaría
  // sus candidaturas sin avisar. Se exige retirarlas antes, de forma explícita.
  const candidaturas = await positionRepository.countCandidaciesByPosition(
    positionId
  );

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
