// src/modules/fairVoting/fairVoting.results.service.js
// Cálculo derivado de RESULTADOS de la votación de feria.
// Anonimato: solo expone conteos por proyecto. NUNCA identifica jurados.

import * as votingRepository from './fairVoting.repository.js';
import * as fairRepository from '../fairs/fair.repository.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { buildVoteRanking } from './fairVoting.helpers.js';
import { parsePagination } from '../../shared/utils/pagination.js';

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

/**
 * GET /api/fairs/:fairId/voting/results — ADMIN de la organización dueña.
 * Devuelve conteos por proyecto (sin identidad de jurados).
 */
export const getVotingResults = async ({ fairId, actor, filters = {} }) => {
  const fair = await loadFair(fairId);
  assertTenantMatch({ fair, actor });

  const [projects, votesByProject, totalVotes] = await Promise.all([
    votingRepository.listApprovedProjects(fairId),
    votingRepository.countVotesByFair(fairId),
    votingRepository.countTotalVotes(fairId),
  ]);

  const ranking = buildVoteRanking(projects, votesByProject);

  // Paginación opcional (la respuesta completa sigue siendo razonable).
  const { page, limit } = parsePagination(filters || {});
  const start = (page - 1) * limit;
  const paged = ranking.slice(start, start + limit);

  return {
    fair_id: fairId,
    fair_name: fair.name,
    fair_status: fair.status,
    total_votes: totalVotes,
    projects: paged,
    pagination: { page, limit, total: ranking.length },
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
