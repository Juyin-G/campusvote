// src/modules/elections/candidateList/candidateList.service.js

import * as candidateListRepository from './candidateList.repository.js';
import * as electionRepository from '../elections/election.repository.js';
import * as ratingRepository from '../../ratings/rating.repository.js';
import { prisma } from '../../../database/prisma.js';
import { ApiError } from '../../../shared/errors/ApiError.js';
import MESSAGES from '../../../constants/messages.js';
import { isValidCategory } from '../../../constants/categories.js';

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

/**
 * F8: valida que la categoría del proyecto pertenezca al catálogo de la
 * organización (category_catalog) o al catálogo OCDE por defecto.
 */
const assertValidCategory = async (electionId, category) => {
  if (category === undefined || category === null || String(category).trim() === '') return;

  const ownerOrgId = await electionRepository.findElectionOwnerOrganization(electionId);
  let catalog = [];
  if (ownerOrgId) {
    const org = await prisma.organization.findUnique({
      where: { id: ownerOrgId },
      select: { categoryCatalog: true },
    });
    catalog = Array.isArray(org?.categoryCatalog) ? org.categoryCatalog : [];
  }

  if (!isValidCategory(category, catalog)) {
    throw ApiError.badRequest(
      `La categoría "${category}" no pertenece al catálogo configurado para esta organización`
    );
  }
};

/**
 * Adjunta a cada proyecto/lista de la feria su resumen de calificaciones:
 * - ratings: { count, average } (1-5) agregado sobre todas sus candidaturas
 * - latestComment: último comentario de un jurado (para la columna "comentario")
 * Solo se ejecuta cuando el cliente lo pide (withRatings=true) o al ordenar por rating.
 */
const attachRatings = async (electionId, lists) => {
  if (!lists || lists.length === 0) return [];

  const listIds = lists.map((l) => l.id);

  const candidacies = await prisma.candidacy.findMany({
    where: { candidateListId: { in: listIds } },
    select: { id: true, candidateListId: true },
  });
  const candidacyIds = candidacies.map((c) => c.id);

  const summaryRows = await ratingRepository.ratingsSummaryByCandidacy(electionId);
  const candToSummary = new Map((summaryRows || []).map((r) => [String(r.candidacy_id), r]));

  const agg = new Map(
    lists.map((l) => [
      l.id,
      { count: 0, total: 0, latestComment: null, latestScore: null },
    ])
  );

  for (const c of candidacies) {
    const entry = agg.get(c.candidateListId);
    if (!entry) continue;
    const s = candToSummary.get(c.id);
    if (s) {
      entry.count += s.rating_count;
      entry.total += s.total_score;
    }
  }

  if (candidacyIds.length > 0) {
    const activeRatings = await prisma.rating.findMany({
      where: { candidacyId: { in: candidacyIds }, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
      select: { candidacyId: true, comment: true, score: true },
    });
    const candToList = new Map(candidacies.map((c) => [c.id, c.candidateListId]));

    for (const r of activeRatings) {
      const listId = candToList.get(r.candidacyId);
      if (!listId || !agg.has(listId)) continue;
      const entry = agg.get(listId);
      if (entry.latestComment === null && entry.latestScore === null) {
        entry.latestComment = r.comment;
        entry.latestScore = r.score;
      }
    }
  }

  return lists.map((l) => {
    const a = agg.get(l.id);
    return {
      ...l,
      ratings: {
        count: a.count,
        average: a.count > 0 ? Number((a.total / a.count).toFixed(2)) : 0,
      },
      latestComment: a.latestComment ?? null,
    };
  });
};

export const listCandidateLists = async (electionId, query = {}) => {
  await requireElection(electionId);

  const {
    search,
    category,
    status,
    sortBy,
    limit,
    offset = 0,
    withRatings = false,
    min_rating,
    max_rating,
    from_date,
    to_date,
  } = query || {};

  // Filtros por rating necesitan el resumen agregado adjunto.
  const needsRatings =
    Boolean(withRatings) ||
    sortBy === 'rating' ||
    min_rating !== undefined ||
    max_rating !== undefined;

  let lists = await candidateListRepository.findCandidateListsByElection(electionId, {
    search,
    category,
    status,
    sortBy,
    fromDate: from_date || undefined,
    toDate: to_date || undefined,
  });

  if (needsRatings) {
    lists = await attachRatings(electionId, lists);

    if (min_rating !== undefined || max_rating !== undefined) {
      const min = min_rating !== undefined ? Number(min_rating) : 0;
      const max = max_rating !== undefined ? Number(max_rating) : 20;
      lists = lists.filter((l) => {
        const avg = l.ratings?.average ?? 0;
        return avg >= min && avg <= max;
      });
    }

    if (sortBy === 'rating') {
      lists = lists
        .slice()
        .sort(
          (a, b) =>
            b.ratings.average - a.ratings.average ||
            b.ratings.count - a.ratings.count ||
            a.name.localeCompare(b.name)
        );
    }
  }

  const total = lists.length;

  // Paginación opcional: si no se envía limit se devuelve todo
  // (comportamiento original requerido por la papeleta).
  if (limit !== undefined && limit !== null) {
    lists = lists.slice(offset, offset + limit);
  }

  return { candidateLists: lists, total };
};

export const getCandidateListById = async (electionId, listId) => {
  await requireElection(electionId);
  return requireListInElection(electionId, listId);
};

export const createCandidateList = async (electionId, body = {}) => {
  await requireDraftElection(electionId);
  await assertValidCategory(electionId, body.category);
  
  const data = {
    electionId: electionId, 
    name: asText(body.name),
  };

  if (body.acronym !== undefined) data.acronym = asNullableText(body.acronym);
  if (body.motto !== undefined) data.motto = asNullableText(body.motto);
  if (body.logo !== undefined) data.logo = asNullableText(body.logo);
  if (body.description !== undefined) data.description = asNullableText(body.description);
  if (body.imageUrl !== undefined) data.imageUrl = asNullableText(body.imageUrl);
  if (body.category !== undefined) data.category = asNullableText(body.category);
  if (body.tags !== undefined) data.tags = Array.isArray(body.tags) ? body.tags : [];

  try {
    return await candidateListRepository.createCandidateList(data);
  } catch (err) {
    throw translatePrismaError(err);
  }
};

export const updateCandidateList = async (electionId, listId, body = {}) => {
  await requireDraftElection(electionId);
  await requireListInElection(electionId, listId);
  await assertValidCategory(electionId, body.category);

  const data = {};

  if (body.name !== undefined) data.name = asText(body.name);
  if (body.acronym !== undefined) data.acronym = asNullableText(body.acronym);
  if (body.motto !== undefined) data.motto = asNullableText(body.motto);
  if (body.logo !== undefined) data.logo = asNullableText(body.logo);
  if (body.description !== undefined) data.description = asNullableText(body.description);
  if (body.imageUrl !== undefined) data.imageUrl = asNullableText(body.imageUrl);
  if (body.category !== undefined) data.category = asNullableText(body.category);
  if (body.tags !== undefined) data.tags = Array.isArray(body.tags) ? body.tags : [];

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