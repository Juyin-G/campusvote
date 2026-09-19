// src/modules/fairResults/fairResult.service.js
// Resultados de FERIAS derivados de la VOTACIÓN ANÓNIMA (fair_votes).
// NO usa las hojas de rúbrica (fair_evaluations) — la rúbrica NO decide
// ganadores; la votación sí.
//
// Reglas del ranking:
//   1. votes DESC
//   2. project.id ASC (desempate determinista)
//   3. Proyectos sin votos al final con votes=null y position=null
//      (no se inventa un 0).
//
// Ganador (winner):
//   - Solo existe cuando fair.status = CLOSED y los resultados fueron
//     publicados (fair_result_publications).
//   - winner=true solo para position === 1 de una feria CLOSED publicada.

import * as resultRepository from './fairResult.repository.js';
import * as fairRepository from '../fairs/fair.repository.js';
import { ApiError } from '../../shared/errors/ApiError.js';

const loadFair = async (fairId) => {
  const fair = await fairRepository.findById(fairId);
  if (!fair) throw ApiError.notFound('Feria no encontrada');
  return fair;
};

const assertTenantMatch = ({ fair, actor }) => {
  if (!actor.organizationId) {
    throw ApiError.forbidden('Tu cuenta no está vinculada a ninguna organización');
  }
  if (fair.organizationId !== actor.organizationId) {
    throw ApiError.forbidden('La feria no pertenece a tu organización');
  }
};

// ── Lógica pura de cálculo (exportada para tests unit sin BD) ────

/**
 * Construye el ranking a partir de los votos por proyecto.
 * @param {string} status - fair.status
 * @param {boolean} published
 * @param {Array<{id:string,name:string}>} projects
 * @param {Map<string, number>} votesByProject
 */
export const buildVoteRanking = ({ status, published = false, projects, votesByProject = new Map() }) => {
  const enriched = projects.map((p) => ({
    project_id: p.id,
    project_name: p.name,
    votes: votesByProject.get(p.id) ?? 0,
  }));
  enriched.sort((a, b) => {
    if (b.votes !== a.votes) return b.votes - a.votes;
    return a.project_id.localeCompare(b.project_id);
  });

  const ranking = [];
  let position = 0;
  for (const entry of enriched) {
    if (entry.votes === 0) {
      ranking.push({ position: null, ...entry, winner: false });
    } else {
      position += 1;
      ranking.push({
        position,
        ...entry,
        winner: published && status === 'CLOSED' && position === 1,
      });
    }
  }
  return ranking;
};

// ── Operación ─────────────────────────────────────────────────────

const mapPublishedBy = (p) =>
  p?.publishedBy
    ? { id: p.publishedBy.id, first_name: p.publishedBy.firstName, last_name: p.publishedBy.lastName }
    : null;

export const getFairResults = async ({ fairId, actor }) => {
  const fair = await loadFair(fairId);
  assertTenantMatch({ fair, actor });

  const [projects, votesByProject, publication] = await Promise.all([
    resultRepository.listApprovedProjects(fairId),
    resultRepository.countVotesByProject(fairId),
    resultRepository.findPublicationByFair(fairId),
  ]);

  const ranking = buildVoteRanking({
    status: fair.status,
    published: Boolean(publication),
    projects,
    votesByProject,
  });

  return {
    fair_id: fair.id,
    fair_name: fair.name,
    fair_status: fair.status,
    published: Boolean(publication),
    published_at: publication?.createdAt ?? null,
    published_by: mapPublishedBy(publication),
    ranking,
  };
};

export const publishFairResults = async ({ fairId, actor }) => {
  const fair = await loadFair(fairId);
  assertTenantMatch({ fair, actor });
  if (fair.status !== 'CLOSED') {
    throw ApiError.conflict('Los resultados solo se publican cuando la feria está cerrada (CLOSED)');
  }
  const existing = await resultRepository.findPublicationByFair(fairId);
  if (existing) {
    throw ApiError.conflict('Los resultados de esta feria ya fueron publicados');
  }
  let publication;
  try {
    publication = await resultRepository.createPublication({ fairId, publishedById: actor.id });
  } catch (err) {
    if (err.message === 'FAIR_RESULT_ALREADY_PUBLISHED') {
      throw ApiError.conflict('Los resultados de esta feria ya fueron publicados');
    }
    throw err;
  }
  return {
    fair_id: fair.id,
    fair_name: fair.name,
    fair_status: fair.status,
    published: true,
    published_at: publication.createdAt,
    published_by: mapPublishedBy(publication),
  };
};

export default {
  getFairResults,
  publishFairResults,
  buildVoteRanking,
};
