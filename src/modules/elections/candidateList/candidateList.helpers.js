// src/modules/elections/candidateList/candidateList.helpers.js
// Helpers y constantes del módulo candidateList (sin HTTP).

import { ApiError } from '../../../shared/errors/ApiError.js';
import MESSAGES from '../../../constants/messages.js';

export const EDITABLE_STATUSES = ['DRAFT', 'SCHEDULED'];

export const asText = (value) => (typeof value === 'string' ? value.trim() : '');

/**
 * La BD acepta NULL pero no cadena vacía en acronym y motto.
 * Un '' del cliente significa "limpiar el campo", así que se traduce a null.
 */
export const asNullableText = (value) => {
  if (value === null) return null;
  const texto = asText(value);
  return texto.length > 0 ? texto : null;
};

export const translatePrismaError = (err) => {
  if (err?.code === 'P2002') {
    return ApiError.conflict('Ya existe una lista con ese nombre o acrónimo en esta elección');
  }
  if (err?.code === 'P2025') return ApiError.notFound('La lista solicitada no existe');
  if (err?.code === 'P2003') return ApiError.badRequest('La elección indicada no es válida');
  return err;
};

export const requireElection = async (electionId, electionRepository) => {
  const election = await electionRepository.findElectionStatus(electionId);
  if (!election) throw ApiError.notFound(MESSAGES.ELECTION.NOT_FOUND);
  return election;
};

export const requireDraftElection = async (electionId, electionRepository) => {
  const election = await requireElection(electionId, electionRepository);
  if (!EDITABLE_STATUSES.includes(election.status)) {
    throw ApiError.conflict(MESSAGES.ELECTION.DRAFT_ONLY_ACTION);
  }
  return election;
};

export const requireListInElection = async (electionId, listId, candidateListRepository) => {
  const list = await candidateListRepository.findCandidateListById(listId);
  if (!list || list.electionId !== electionId) {
    throw ApiError.notFound('La lista solicitada no existe en esta elección');
  }
  return list;
};
