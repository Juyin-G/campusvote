// src/modules/ratings/rating.results.service.js
// Resultados + listado trazable de calificaciones (doble ciego).

import * as ratingRepository from './rating.repository.js';
import * as electionRepository from '../elections/elections/election.repository.js';
import { prisma } from '../../database/prisma.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { ROLES, RUBRIC_MAX_SCORE } from './rating.constants.js';
import { assertTenantAccess } from './rating.access.js';
import { isSuperAdmin } from './rating.helpers.js';

/** Resultados de una feria con el promedio ponderado por proyecto. */
export const getRatingResults = async ({ electionId, actor }) => {
  const election = await electionRepository.findElectionById(electionId);
  if (!election) throw ApiError.notFound('Elección no encontrada');
  await assertTenantAccess({ electionId, actor });

  const criteria = await ratingRepository.listCriteria(electionId);
  const summary = await ratingRepository.ratingsSummaryByCandidacy(electionId);

  const candidacies = await prisma.candidacy.findMany({
    where: { electionId },
    select: {
      id: true,
      userId: true,
      status: true,
      candidateList: { select: { id: true, name: true, acronym: true } },
      user: { select: { id: true, firstName: true, lastName: true, institutionalId: true } },
    },
  });

  const scoreMap = new Map((summary || []).map((r) => [String(r.candidacy_id), r]));

  const projects = candidacies
    .map((c) => {
      const s = scoreMap.get(c.id) || { rating_count: 0, average_score: 0, total_score: 0 };
      return {
        project_id: c.id,
        project_name: c.candidateList?.name || 'Proyecto',
        project_acronym: c.candidateList?.acronym || null,
        expositor_id: c.user?.id || null,
        expositor_name: c.user ? `${c.user.firstName} ${c.user.lastName}`.trim() : null,
        rating_count: s.rating_count,
        average_score: Number(s.average_score) || 0,
        total_score: Number(s.total_score) || 0,
      };
    })
    .sort((a, b) => b.average_score - a.average_score || b.total_score - a.total_score);

  return {
    election_id: electionId,
    process_type: election.processType,
    status: election.status,
    max_score: RUBRIC_MAX_SCORE,
    criteria,
    projects,
    rated_projects: projects.filter((p) => p.rating_count > 0).length,
  };
};

/** Lista calificaciones trazables. Doble ciego: el nombre del jurado solo
 * se expone a ADMIN/SUPERADMIN; el resto ve la matriz anónima. */
export const listRatings = async ({ electionId, candidacyId, status, limit, offset, actor }) => {
  await electionRepository.findElectionById(electionId);
  await assertTenantAccess({ electionId, actor });

  const items = await ratingRepository.listRatingsByElection({
    electionId,
    candidacyId,
    status,
    limit,
    offset,
  });
  const total = await prisma.rating.count({
    where: { electionId, ...(candidacyId ? { candidacyId } : {}), ...(status ? { status } : {}) },
  });

  const revealJuror = isSuperAdmin(actor) || actor.role === ROLES.ADMIN;

  return {
    items: items.map((r) => ({
      id: r.id,
      election_id: r.electionId,
      candidacy_id: r.candidacyId,
      juror: revealJuror ? r.juror : null,
      score: r.score,
      comment: r.comment,
      status: r.status,
      details: r.ratingDetails || [],
      created_at: r.createdAt,
    })),
    total,
    limit: limit ?? 50,
    offset: offset ?? 0,
    double_blind: !revealJuror,
  };
};
