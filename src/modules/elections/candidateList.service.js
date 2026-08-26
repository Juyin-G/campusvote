// src/modules/elections/candidateList.service.js
// S4-06 — Lógica de negocio de listas candidatas dentro de una elección.

import * as candidateListRepository from './candidateList.repository.js';
import * as electionRepository from './election.repository.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import MESSAGES from '../../constants/messages.js';

/** Las listas solo pueden tocarse mientras la elección sea borrador. */
const EDITABLE_STATUSES = ['DRAFT'];

const asText = (value) => (typeof value === 'string' ? value.trim() : '');

/**
 * La BD acepta NULL pero no cadena vacía en acronym y motto
 * (CHECK ... IS NULL OR length(trim(...)) > 0).
 * Un '' del cliente significa "limpiar el campo", así que se traduce a null.
 */
const asNullableText = (value) => {
  if (value === null) return null;
  const texto = asText(value);
  return texto.length > 0 ? texto : null;
};

const translatePrismaError = (err) => {
  if (err?.code === 'P2002') {
    return ApiError.conflict('Ya existe una lista con ese nombre en esta elección');
  }
  if (err?.code === 'P2025') {
    return ApiError.notFound('La lista solicitada no existe');
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
    throw ApiError.conflict(MESSAGES.ELECTION.DRAFT_ONLY_ACTION);
  }

  return election;
};

/**
 * Carga la lista y verifica que pertenezca a esa elección.
 * Evita que, conociendo un id, se acceda a listas de otra elección
 * a través de la ruta anidada.
 */
const requireListInElection = async (electionId, listId) => {
  const list = await candidateListRepository.findCandidateListById(listId);

  if (!list || list.election_id !== electionId) {
    throw ApiError.notFound('La lista solicitada no existe en esta elección');
  }

  return list;
};

export const listCandidateLists = async (electionId) => {
  await requireElection(electionId);

  const lists =
    await candidateListRepository.findCandidateListsByElection(electionId);

  return { candidateLists: lists, total: lists.length };
};

export const getCandidateListById = async (electionId, listId) => {
  await requireElection(electionId);

  return requireListInElection(electionId, listId);
};

export const createCandidateList = async (electionId, body = {}) => {
  await requireDraftElection(electionId);

  const data = {
    election_id: electionId,
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

  // La FK de candidacies es ON DELETE CASCADE: borrar la lista se llevaría
  // a sus integrantes en silencio. Se exige retirarlos primero.
  const candidaturas =
    await candidateListRepository.countCandidaciesByList(listId);

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
