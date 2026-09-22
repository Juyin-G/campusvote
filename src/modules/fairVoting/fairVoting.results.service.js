// src/modules/fairVoting/fairVoting.results.service.js
// Cálculo derivado de RESULTADOS de la votación de feria.
// Anonimato: solo expone conteos por proyecto. NUNCA identifica jurados.
// Los resultados se devuelven AGRUPADOS POR CATEGORÍA.
// La lógica de votos, anonimato y buildVoteRanking() no se modifica.

import * as votingRepository from './fairVoting.repository.js';
import * as fairRepository from '../fairs/fair.repository.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { buildVoteRanking } from './fairVoting.helpers.js';

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

const SIN_CATEGORIA = '__sin_categoria__';

/**
 * Agrupa el ranking derivado en bloques por categoría.
 * Proyectos sin categoría se agrupan bajo la clave SIN_CATEGORIA.
 * Cada bloque incluye winner (proyecto con mayor cantidad de votos) o null
 * si la categoría no tiene proyectos con votos > 0.
 */
const groupByCategory = (ranking) => {
  const buckets = new Map();
  for (const entry of ranking) {
    // El select incluye `category: { id, name }` cuando el proyecto tiene categoría.
    // Para los proyectos sin categoría, usamos la clave SIN_CATEGORIA.
    const cat = entry.category;
    const key = cat?.id || SIN_CATEGORIA;
    if (!buckets.has(key)) {
      buckets.set(key, {
        category_id: cat?.id || null,
        category_name: cat?.name || 'Sin categoría',
        projects: [],
      });
    }
    buckets.get(key).projects.push(entry);
  }
  // Cada bucket: ordena proyectos por votes DESC (ya vienen así del ranking).
  // winner = primer proyecto con votes > 0 dentro del bucket.
  const categories = [];
  for (const bucket of buckets.values()) {
    const winnerEntry = bucket.projects.find((p) => (p.votes ?? 0) > 0) || null;
    categories.push({
      category_id: bucket.category_id,
      category_name: bucket.category_name,
      winner: winnerEntry
        ? {
            project_id: winnerEntry.project_id,
            project_name: winnerEntry.project_name,
            votes: winnerEntry.votes,
          }
        : null,
      projects: bucket.projects,
    });
  }
  return categories;
};

/**
 * GET /api/fairs/:fairId/voting/results — ADMIN de la organización dueña.
 * Devuelve resultados AGRUPADOS POR CATEGORÍA (sin identidad de jurados).
 */
export const getVotingResults = async ({ fairId, actor }) => {
  const fair = await loadFair(fairId);
  assertTenantMatch({ fair, actor });

  const [projects, votesByProject, totalVotes] = await Promise.all([
    votingRepository.listApprovedProjects(fairId),
    votingRepository.countVotesByFair(fairId),
    votingRepository.countTotalVotes(fairId),
  ]);

  const ranking = buildVoteRanking(projects, votesByProject);
  const categories = groupByCategory(ranking);

  return {
    fair_id: fairId,
    fair_name: fair.name,
    fair_status: fair.status,
    total_votes: totalVotes,
    // Ranking completo (todas las categorías) además del agrupado por categoría.
    projects: ranking,
    categories,
    pagination: { total: categories.length },
  };
};

/**
 * GET /api/fairs/:fairId/voting/verify/:receiptCode — público.
 * Verifica que un comprobante corresponde a un voto de la feria.
 * NO revela identidad ni el proyecto elegido.
 */
export const verifyReceipt = async ({ fairId, receiptCode }) => {
  const fair = await loadFair(fairId);
  const vote = await votingRepository.findVoteByReceipt(fairId, receiptCode);
  if (!vote) {
    return {
      valid: false,
      message: 'El comprobante no corresponde a un voto registrado',
    };
  }
  return {
    valid: true,
    fair_id: fair.id,
    fair_name: fair.name,
    fair_status: fair.status,
    cast_at: vote.createdAt,
    receipt_code: vote.receiptCode,
    message: 'Comprobante válido',
  };
};

export default {
  getVotingResults,
  verifyReceipt,
};
