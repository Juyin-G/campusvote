// src/modules/elections/candidateList/candidateList.crud.service.js
// CRUD de listas de candidatos.

import * as candidateListRepository from './candidateList.repository.js';
import * as electionRepository from '../elections/election.repository.js';
import { prisma } from '../../../database/prisma.js';
import { ApiError } from '../../../shared/errors/ApiError.js';
import { parsePagination } from '../../../shared/utils/pagination.js';
import { isValidCategory } from '../../../constants/categories.js';
import {
  asNullableText,
  asText,
  requireDraftElection,
  requireElection,
  requireListInElection,
  translatePrismaError,
} from './candidateList.helpers.js';

export const listCandidateLists = async (electionId, query = {}) => {
  await requireElection(electionId, electionRepository);
  // Sin page/limit se devuelven todas: la cédula necesita todas las listas.
  const paginate = query.page !== undefined || query.limit !== undefined;
  const { page, limit, skip, take } = paginate
    ? parsePagination(query)
    : { page: 1, limit: null, skip: undefined, take: undefined };
  const where = { electionId };
  if (query.search) {
    where.name = { contains: query.search, mode: 'insensitive' };
  }
  const [total, lists] = await Promise.all([
    candidateListRepository.count(where),
    candidateListRepository.list({ where, skip, take }),
  ]);
  
  return { data: lists, pagination: { page, limit, total } };
};

export const getCandidateListById = async (electionId, listId) => {
  await requireElection(electionId, electionRepository);
  return requireListInElection(electionId, listId, candidateListRepository);
};

export const createCandidateList = async (electionId, body = {}) => {
  await requireDraftElection(electionId, electionRepository);
  const data = {
    electionId,
    name: asText(body.name),
    acronym: asNullableText(body.acronym ?? null),
    motto: asNullableText(body.motto ?? null),
    logo: asNullableText(body.logo ?? null), // CORRECCIÓN 1: Sanitización con trim / null
  };
  try {
    return await candidateListRepository.create(data);
  } catch (err) {
    throw translatePrismaError(err);
  }
};

export const updateCandidateList = async (electionId, listId, body = {}) => {
  await requireDraftElection(electionId, electionRepository);
  await requireListInElection(electionId, listId, candidateListRepository);

  const data = {};
  if (body.name !== undefined) data.name = asText(body.name);
  if (body.acronym !== undefined) data.acronym = asNullableText(body.acronym);
  if (body.motto !== undefined) data.motto = asNullableText(body.motto);
  if (body.logo !== undefined) data.logo = asNullableText(body.logo); // CORRECCIÓN 1: Sanitización con trim / null
  
  if (Object.keys(data).length === 0) {
    throw ApiError.badRequest('No hay campos para actualizar');
  }
  try {
    return await candidateListRepository.update(listId, data);
  } catch (err) {
    throw translatePrismaError(err);
  }
};

export const deleteCandidateList = async (electionId, listId) => {
  await requireDraftElection(electionId, electionRepository);
  await requireListInElection(electionId, listId, candidateListRepository);

  // CORRECCIÓN 2: Verificar candidaturas asociadas antes de borrar y lanzar error 409
  const candidaciesCount = await candidateListRepository.countCandidaciesByList(listId);
  if (candidaciesCount > 0) {
    throw new ApiError(409, 'No se puede eliminar la lista porque contiene candidaturas asociadas.');
  }

  try {
    await candidateListRepository.delete(listId);
    return { deleted: true, id: listId };
  } catch (err) {
    throw translatePrismaError(err);
  }
};