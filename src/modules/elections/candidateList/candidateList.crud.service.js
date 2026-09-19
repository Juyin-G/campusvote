// src/modules/elections/candidateList/candidateList.crud.service.js
// CRUD de listas de candidatos.

import * as candidateListRepository from './candidateList.repository.js';
import * as electionRepository from '../elections/election.repository.js';
import * as ratingRepository from '../../ratings/rating.repository.js';
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
 * Adjunta a cada proyecto su resumen de calificaciones (count/average).
 * Solo se ejecuta cuando withRatings=true o al ordenar por rating.
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
  await requireElection(electionId, electionRepository);
  const { page, limit, skip, take } = parsePagination(query);
  const where = { electionId };
  if (query.search) {
    where.name = { contains: query.search, mode: 'insensitive' };
  }
  const [total, lists] = await Promise.all([
    candidateListRepository.count(where),
    candidateListRepository.list({ where, skip, take }),
  ]);
  const enriched = query.withRatings === 'true' || query.withRatings === true
    ? await attachRatings(electionId, lists)
    : lists;
  return { data: enriched, pagination: { page, limit, total } };
};

export const getCandidateListById = async (electionId, listId) => {
  await requireElection(electionId, electionRepository);
  return requireListInElection(electionId, listId, candidateListRepository);
};

export const createCandidateList = async (electionId, body = {}) => {
  await requireDraftElection(electionId, electionRepository);
  await assertValidCategory(electionId, body.category);
  const data = {
    electionId,
    name: asText(body.name),
    acronym: asNullableText(body.acronym ?? null),
    motto: asNullableText(body.motto ?? null),
    logo: body.logo || null,
    description: body.description || null,
    imageUrl: body.imageUrl ?? body.image_url ?? null,
    category: body.category || null,
    tags: Array.isArray(body.tags) ? body.tags : [],
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
  await assertValidCategory(electionId, body.category);

  const data = {};
  if (body.name !== undefined) data.name = asText(body.name);
  if (body.acronym !== undefined) data.acronym = asNullableText(body.acronym);
  if (body.motto !== undefined) data.motto = asNullableText(body.motto);
  if (body.logo !== undefined) data.logo = body.logo || null;
  if (body.description !== undefined) data.description = body.description || null;
  if (body.imageUrl !== undefined || body.image_url !== undefined) {
    data.imageUrl = body.imageUrl ?? body.image_url ?? null;
  }
  if (body.category !== undefined) data.category = body.category || null;
  if (body.tags !== undefined) {
    data.tags = Array.isArray(body.tags) ? body.tags : [];
  }
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
  try {
    await candidateListRepository.delete(listId);
    return { deleted: true, id: listId };
  } catch (err) {
    throw translatePrismaError(err);
  }
};
