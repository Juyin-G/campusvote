// src/modules/elections/candidacy.service.js
// S4-08 — Lógica de negocio de candidaturas dentro de una elección.

import * as candidacyRepository from './candidacy.repository.js';
import * as candidateListRepository from './candidateList.repository.js';
import * as positionRepository from './position.repository.js';
import * as electionRepository from './election.repository.js';
import * as userRepository from '../users/user.repository.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import MESSAGES from '../../constants/messages.js';

/** Las candidaturas solo se tocan mientras la elección sea borrador. */
const EDITABLE_STATUSES = ['DRAFT'];

/** El modelo User viene en camelCase; la API del módulo responde snake_case. */
const formatCandidacy = (candidacy) => {
  if (!candidacy) return candidacy;

  const { user, ...resto } = candidacy;

  return {
    ...resto,
    user: user
      ? {
          id: user.id,
          username: user.username,
          first_name: user.firstName,
          last_name: user.lastName,
          institutional_id: user.institutionalId,
        }
      : null,
  };
};

const translatePrismaError = (err) => {
  if (err?.code === 'P2002') {
    const target = String(err?.meta?.target ?? '');

    // uq_candidacies_position_user vs uq_candidacies_election_user
    if (target.includes('position')) {
      return ApiError.conflict(
        'El usuario ya tiene una candidatura registrada para ese cargo'
      );
    }
    return ApiError.conflict(
      'El usuario ya es candidato en esta elección'
    );
  }
  if (err?.code === 'P2025') {
    return ApiError.notFound('La candidatura solicitada no existe');
  }
  // La FK compuesta (candidate_list_id, election_id) falla como P2003
  if (err?.code === 'P2003') {
    return ApiError.badRequest(
      'La lista, el cargo o el usuario indicado no es válido para esta elección'
    );
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
    throw ApiError.conflict(MESSAGES.ELECTION.DRAFT_ONLY_ACTION);
  }

  return election;
};

const requireCandidacyInElection = async (electionId, candidacyId) => {
  const candidacy = await candidacyRepository.findCandidacyById(candidacyId);

  if (!candidacy || candidacy.election_id !== electionId) {
    throw ApiError.notFound('La candidatura solicitada no existe en esta elección');
  }

  return candidacy;
};

/**
 * La FK compuesta (candidate_list_id, election_id) ya impide asociar una lista
 * de otra elección, pero fallaría como P2003 genérico. Comprobarlo aquí da un
 * error entendible y señala el campo exacto.
 */
const requireListInElection = async (electionId, listId) => {
  const list = await candidateListRepository.findCandidateListById(listId);

  if (!list || list.election_id !== electionId) {
    throw ApiError.badRequest(
      'La lista candidata indicada no pertenece a esta elección'
    );
  }

  return list;
};

const requirePositionInElection = async (electionId, positionId) => {
  const position = await positionRepository.findPositionById(positionId);

  if (!position || position.election_id !== electionId) {
    throw ApiError.badRequest('El cargo indicado no pertenece a esta elección');
  }

  return position;
};

/** El candidato debe existir y tener la cuenta activa. */
const requireActiveUser = async (userId) => {
  const user = await userRepository.findById(userId);

  if (!user) {
    throw ApiError.badRequest('El usuario indicado no existe');
  }
  if (!user.isActive) {
    throw ApiError.badRequest(
      'El usuario indicado tiene la cuenta inactiva y no puede ser candidato'
    );
  }

  return user;
};

export const listCandidacies = async (electionId, query = {}) => {
  await requireElection(electionId);

  const filters = {
    candidate_list_id: query.candidate_list_id,
    position_id: query.position_id,
  };

  const candidacies = await candidacyRepository.findCandidaciesByElection(
    electionId,
    filters
  );

  return {
    candidacies: candidacies.map(formatCandidacy),
    total: candidacies.length,
  };
};

export const getCandidacyById = async (electionId, candidacyId) => {
  await requireElection(electionId);

  const candidacy = await requireCandidacyInElection(electionId, candidacyId);

  return formatCandidacy(candidacy);
};

export const createCandidacy = async (electionId, body = {}) => {
  await requireDraftElection(electionId);
  await requireListInElection(electionId, body.candidate_list_id);

  if (body.position_id) {
    await requirePositionInElection(electionId, body.position_id);
  }

  await requireActiveUser(body.user_id);

  // uq_candidacies_election_user: una persona, una sola candidatura por elección.
  // Se comprueba antes para poder decir en qué lista ya está inscrita.
  const existente = await candidacyRepository.findCandidacyByElectionAndUser(
    electionId,
    body.user_id
  );

  if (existente) {
    throw ApiError.conflict(
      'El usuario ya es candidato en esta elección dentro de otra lista'
    );
  }

  const data = {
    election_id: electionId,
    candidate_list_id: body.candidate_list_id,
    user_id: body.user_id,
    position_id: body.position_id ?? null,
  };

  if (body.order_index !== undefined) data.order_index = Number(body.order_index);
  if (body.is_principal !== undefined) data.is_principal = body.is_principal;

  try {
    const creada = await candidacyRepository.createCandidacy(data);
    return formatCandidacy(creada);
  } catch (err) {
    throw translatePrismaError(err);
  }
};

export const updateCandidacy = async (electionId, candidacyId, body = {}) => {
  await requireDraftElection(electionId);
  await requireCandidacyInElection(electionId, candidacyId);

  if (body.candidate_list_id !== undefined) {
    await requireListInElection(electionId, body.candidate_list_id);
  }
  if (body.position_id) {
    await requirePositionInElection(electionId, body.position_id);
  }

  const data = {};

  if (body.candidate_list_id !== undefined) {
    data.candidate_list_id = body.candidate_list_id;
  }
  if (body.position_id !== undefined) {
    data.position_id = body.position_id ?? null;
  }
  if (body.order_index !== undefined) {
    data.order_index = Number(body.order_index);
  }
  if (body.is_principal !== undefined) data.is_principal = body.is_principal;

  if (Object.keys(data).length === 0) {
    throw ApiError.badRequest(MESSAGES.COMMON.BAD_REQUEST);
  }

  try {
    const actualizada = await candidacyRepository.updateCandidacy(
      candidacyId,
      data
    );
    return formatCandidacy(actualizada);
  } catch (err) {
    throw translatePrismaError(err);
  }
};

export const deleteCandidacy = async (electionId, candidacyId) => {
  await requireDraftElection(electionId);
  await requireCandidacyInElection(electionId, candidacyId);

  try {
    await candidacyRepository.deleteCandidacyById(candidacyId);
    return { deleted: true };
  } catch (err) {
    throw translatePrismaError(err);
  }
};

export default {
  listCandidacies,
  getCandidacyById,
  createCandidacy,
  updateCandidacy,
  deleteCandidacy,
};
