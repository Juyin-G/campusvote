// src/modules/elections/candidacy/candidacy.service.js
// S4-08 — Lógica de negocio de candidaturas dentro de una elección.

import * as candidacyRepository from './candidacy.repository.js';
import * as candidateListRepository from '../candidateList/candidateList.repository.js';
import * as positionRepository from '../positions/position.repository.js';
import * as electionRepository from '../elections/election.repository.js';
import * as userRepository from '../../users/user.repository.js';
import { ApiError } from '../../../shared/errors/ApiError.js';
import MESSAGES from '../../../constants/messages.js';

/** Las candidaturas se pueden modificar si la elección está en borrador o agendada. */
const EDITABLE_STATUSES = ['DRAFT', 'SCHEDULED'];

/** Normaliza las propiedades del usuario e internas a formato de respuesta snake_case API */
const formatCandidacy = (candidacy) => {
  if (!candidacy) return candidacy;

  const {
    id,
    electionId,
    election_id,
    candidateListId,
    candidate_list_id,
    positionId,
    position_id,
    userId,
    user_id,
    orderIndex,
    order_index,
    isPrincipal,
    is_principal,
    status, // <-- CAMPO AGREGADO
    createdAt,
    created_at,
    updatedAt,
    updated_at,
    user,
    ...resto
  } = candidacy;

  return {
    id,
    election_id: electionId ?? election_id,
    candidate_list_id: candidateListId ?? candidate_list_id,
    position_id: positionId ?? position_id ?? null,
    user_id: userId ?? user_id,
    order_index: orderIndex ?? order_index,
    is_principal: isPrincipal ?? is_principal,
    status: status ?? 'PENDING', // <-- CAMPO AGREGADO (con fallback por seguridad)
    created_at: createdAt ?? created_at,
    updated_at: updatedAt ?? updated_at,
    ...resto,
    user: user
      ? {
          id: user.id,
          username: user.username,
          first_name: user.firstName ?? user.first_name,
          last_name: user.lastName ?? user.last_name,
          institutional_id: user.institutionalId ?? user.institutional_id,
        }
      : null,
  };
};

const translatePrismaError = (err) => {
  if (err?.code === 'P2002') {
    const target = String(err?.meta?.target ?? '');

    if (target.includes('one_principal_per_position')) {
      return ApiError.conflict(
        'Ya existe un candidato principal asignado para este cargo en la lista'
      );
    }
    if (target.includes('list_position_order')) {
      return ApiError.conflict(
        'Ya existe una candidatura asignada con el mismo número de orden para esta lista y cargo'
      );
    }
    if (target.includes('election_user')) {
      return ApiError.conflict(
        'El usuario ya es candidato registrado en esta elección'
      );
    }
    return ApiError.conflict('Conflicto de duplicidad en los datos de la candidatura');
  }

  if (err?.code === 'P2025') {
    return ApiError.notFound('La candidatura solicitada no existe');
  }

  if (err?.code === 'P2003') {
    return ApiError.badRequest(
      'La lista, el cargo o el usuario indicado no son válidos para esta elección'
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
  const currentElectionId = candidacy?.electionId ?? candidacy?.election_id;

  if (!candidacy || currentElectionId !== electionId) {
    throw ApiError.notFound('La candidatura solicitada no existe en esta elección');
  }

  return candidacy;
};

const requireListInElection = async (electionId, listId) => {
  const list = await candidateListRepository.findCandidateListById(listId);
  const currentElectionId = list?.electionId ?? list?.election_id;

  if (!list || currentElectionId !== electionId) {
    throw ApiError.badRequest(
      'La lista candidata indicada no pertenece a esta elección'
    );
  }

  return list;
};

const requirePositionInElection = async (electionId, positionId) => {
  const position = await positionRepository.findPositionById(positionId);
  const currentElectionId = position?.electionId ?? position?.election_id;

  if (!position || currentElectionId !== electionId) {
    throw ApiError.badRequest('El cargo indicado no pertenece a esta elección');
  }

  return position;
};

const requireActiveUser = async (userId) => {
  const user = await userRepository.findById(userId);

  if (!user) {
    throw ApiError.badRequest('El usuario indicado no existe');
  }
  if (user.status !== 'ACTIVE') {
    throw ApiError.badRequest(
      'El usuario indicado tiene la cuenta inactiva y no puede ser candidato'
    );
  }

  return user;
};

export const listCandidacies = async (electionId, query = {}) => {
  await requireElection(electionId);

  const filters = {
    candidateListId: query.candidate_list_id,
    positionId: query.position_id,
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

  const existente = await candidacyRepository.findCandidacyByElectionAndUser(
    electionId,
    body.user_id
  );

  if (existente) {
    throw ApiError.conflict(
      'El usuario ya es candidato en esta elección dentro de una lista'
    );
  }

  const data = {
    electionId,
    candidateListId: body.candidate_list_id,
    userId: body.user_id,
    positionId: body.position_id ?? null,
    orderIndex: body.order_index !== undefined ? Number(body.order_index) : 1,
    isPrincipal: body.is_principal !== undefined ? Boolean(body.is_principal) : true,
    // NOTA: No se envía 'status'. Prisma aplicará el DEFAULT 'PENDING' definido en el esquema.
  };

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
  if (body.position_id !== undefined) { // Corregido: verificar si existe, no solo si es truthy (podría ser null)
    await requirePositionInElection(electionId, body.position_id);
  }

  const data = {};

  if (body.candidate_list_id !== undefined) {
    data.candidateListId = body.candidate_list_id;
  }
  if (body.position_id !== undefined) {
    data.positionId = body.position_id ?? null;
  }
  if (body.order_index !== undefined) {
    data.orderIndex = Number(body.order_index);
  }
  if (body.is_principal !== undefined) {
    data.isPrincipal = Boolean(body.is_principal);
  }
  
  // NOTA DE SEGURIDAD: No permitimos actualizar 'status' aquí. 
  // El cambio de estado (APPROVED/REJECTED) debe manejarse en un endpoint dedicado 
  // (ej. updateCandidacyStatus) para separar la edición de datos de la aprobación administrativa.

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