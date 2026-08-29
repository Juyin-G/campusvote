// src/modules/results/results.service.js
// S7-05 — Servicio de resultados en vivo y finales.
//
// Responsabilidades:
//   - LIVE: obtener resultados para elecciones en estado
//     CLOSED, CERTIFIED o PUBLISHED.
//   - FINAL: obtener resultados únicamente para elecciones
//     PUBLISHED.
//   - Componer la respuesta normalizada con election_results
//     + tallies desglosados por position.
//
// NO accede a Prisma directamente.
// NO conoce HTTP.

import resultsRepository from './results.repository.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import MESSAGES from '../../constants/messages.js';

const LIVE_ALLOWED_STATUSES = ['CLOSED', 'CERTIFIED', 'PUBLISHED'];

/**
 * Normaliza un set de tallies con su contexto en una estructura
 * apta para /results/live y /results/final.
 *
 * Salida:
 *   {
 *     positions: [
 *       { position_id, position_name, seats, options: [
 *           { option_id, label, option_type, candidate_list_id,
 *             votes_count, percentage }
 *         ]
 *       }
 *     ]
 *   }
 */
const composeTalliesByPosition = (talliesWithContext) => {
  const positionsMap = new Map();

  for (const t of talliesWithContext) {
    const optionResolved = t.ballotOption;
    const pos = optionResolved?.ballotPosition?.position;
    if (!optionResolved || !pos) continue;

    if (!positionsMap.has(pos.id)) {
      positionsMap.set(pos.id, {
        position_id: pos.id,
        position_name: pos.name,
        seats: pos.seats,
        options: [],
      });
    }

    positionsMap.get(pos.id).options.push({
      option_id: t.optionId,
      label: optionResolved.label,
      option_type: optionResolved.optionType,
      candidate_list_id: optionResolved.candidateListId,
      votes_count: t.votesCount,
    });
  }

  // Calcular porcentaje por opción dentro de su cargo.
  for (const p of positionsMap.values()) {
    const total = p.options.reduce((acc, o) => acc + o.votes_count, 0);
    for (const o of p.options) {
      o.percentage =
        total === 0 ? 0 : Number(((o.votes_count / total) * 100).toFixed(2));
    }
    // Ordenar por votes_count descendente.
    p.options.sort((a, b) => b.votes_count - a.votes_count);
  }

  return {
    positions: Array.from(positionsMap.values()),
  };
};

const assertElectionId = (electionId) => {
  if (!electionId || typeof electionId !== 'string') {
    throw ApiError.badRequest('El ID de la elección es requerido');
  }
};

/**
 * Devuelve resultados en vivo de una elección.
 * Permitido solo en estados CLOSED, CERTIFIED, PUBLISHED.
 */
export const getLiveResults = async (electionId) => {
  assertElectionId(electionId);

  const status = await resultsRepository.findElectionStatus(electionId);
  if (!status) {
    throw ApiError.notFound(MESSAGES.ELECTION.NOT_FOUND);
  }

  if (!LIVE_ALLOWED_STATUSES.includes(status.status)) {
    throw ApiError.conflict(
      `Los resultados en vivo solo están disponibles para elecciones en estado ` +
        `${LIVE_ALLOWED_STATUSES.join(', ')}. Estado actual: ${status.status}`
    );
  }

  const [result, tallies] = await Promise.all([
    resultsRepository.findElectionResult(electionId),
    resultsRepository.findTalliesWithContext(electionId),
  ]);

  return {
    election_id: electionId,
    status: status.status,
    summary: result,
    detail: composeTalliesByPosition(tallies),
  };
};

/**
 * Devuelve resultados finales.
 * Permitido solo si el estado es PUBLISHED.
 */
export const getFinalResults = async (electionId) => {
  assertElectionId(electionId);

  const status = await resultsRepository.findElectionStatus(electionId);
  if (!status) {
    throw ApiError.notFound(MESSAGES.ELECTION.NOT_FOUND);
  }

  if (status.status !== 'PUBLISHED') {
    throw ApiError.notFound(MESSAGES.RESULTS.NOT_AVAILABLE);
  }

  const [result, tallies] = await Promise.all([
    resultsRepository.findElectionResult(electionId),
    resultsRepository.findTalliesWithContext(electionId),
  ]);

  return {
    election_id: electionId,
    status: status.status,
    summary: result,
    detail: composeTalliesByPosition(tallies),
  };
};

export default {
  getLiveResults,
  getFinalResults,
};
