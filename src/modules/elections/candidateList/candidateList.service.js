// src/modules/elections/candidateList/candidateList.service.js

import * as candidateListRepository from './candidateList.repository.js';
import * as electionRepository from '../elections/election.repository.js';
import { ApiError } from '../../../shared/errors/ApiError.js';
import MESSAGES from '../../../constants/messages.js';

/** Alineado con el trigger de la BD y el módulo de candidaturas */
const EDITABLE_STATUSES = ['DRAFT', 'SCHEDULED'];

const asText = (value) => (typeof value === 'string' ? value.trim() : '');

/**
 * La BD acepta NULL pero no cadena vacía en acronym y motto.
 * Un '' del cliente significa "limpiar el campo", así que se traduce a null.
 */
const asNullableText = (value) => {
  if (value === null) return null;
  const texto = asText(value);
  return texto.length > 0 ? texto : null;
};

const translatePrismaError = (err) => {
  if (err?.code === 'P2002') {
    // Prisma puede devolver el nombre de la restricción única, podemos ser más específicos si queremos
    return ApiError.conflict('Ya existe una lista con ese nombre o acrónimo en esta elección');
  }
  if (err?.code === 'P2025') {
    return ApiError.notFound('La lista solicitada no existe');
  }
  if (err?.code === 'P2003') {
    return ApiError.badRequest('La elección indicada no es válida');
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

const requireListInElection = async (electionId, listId) => {
  const list = await candidateListRepository.findCandidateListById(listId);

  // CORRECCIÓN: Prisma devuelve 'electionId' (camelCase), no 'election_id'
  if (!list || list.electionId !== electionId) {
    throw ApiError.notFound('La lista solicitada no existe en esta elección');
  }

  return list;
};

export const listCandidateLists = async (electionId) => {
  await requireElection(electionId);

  const lists = await candidateListRepository.findCandidateListsByElection(electionId);

  return { candidateLists: lists, total: lists.length };
};

export const getCandidateListById = async (electionId, listId) => {
  await requireElection(electionId);
  return requireListInElection(electionId, listId);
};

export const createCandidateList = async (electionId, body = {}) => {
  await requireDraftElection(electionId);
  
  const data = {
    electionId: electionId, 
    name: asText(body.name),
  };

  if (body.acronym !== undefined) data.acronym = asNullableText(body.acronym);
  if (body.motto !== undefined) data.motto = asNullableText(body.motto);
  if (body.logo !== undefined) data.logo = asNullableText(body.logo);

  try {
    return await candidateListRepository.createCandidateList(data);
  } catch (err) {
    throw translatePrismaError(err);
  }
};

export const updateCandidateList = async (electionId, listId, body = {}) => {
  await requireDraftElection(electionId);
  await requireListInElection(electionId, listId);

  const data = {};

  if (body.name !== undefined) data.name = asText(body.name);
  if (body.acronym !== undefined) data.acronym = asNullableText(body.acronym);
  if (body.motto !== undefined) data.motto = asNullableText(body.motto);
  if (body.logo !== undefined) data.logo = asNullableText(body.logo);

  if (Object.keys(data).length === 0) {
    throw ApiError.badRequest(MESSAGES.COMMON.BAD_REQUEST);
  }

  try {
    return await candidateListRepository.updateCandidateList(listId, data);
  } catch (err) {
    throw translatePrismaError(err);
  }
};

export const deleteCandidateList = async (electionId, listId) => {
  await requireDraftElection(electionId);
  await requireListInElection(electionId, listId);

  const candidaturas = await candidateListRepository.countCandidaciesByList(listId);

  if (candidaturas > 0) {
    throw ApiError.conflict(
      `No se puede eliminar la lista: tiene ${candidaturas} candidatura(s) asociada(s). Retíralas primero.`
    );
  }

  try {
    await candidateListRepository.deleteCandidateListById(listId);
    return { deleted: true };
  } catch (err) {
    throw translatePrismaError(err);
  }
};

export default {
  listCandidateLists,
  getCandidateListById,
  createCandidateList,
  updateCandidateList,
  deleteCandidateList,
};