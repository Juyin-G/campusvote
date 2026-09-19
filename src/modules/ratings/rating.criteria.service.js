// src/modules/ratings/rating.criteria.service.js
// Gestión de criterios de la rúbrica electoral (createCriterion, getCriteria,
// removeCriterion).

import * as ratingRepository from './rating.repository.js';
import * as electionRepository from '../elections/elections/election.repository.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import {
  RATING_PROCESS_TYPES,
  RUBRIC_CONFIGURABLE_STATUSES,
  RUBRIC_MAX_SCORE,
} from './rating.constants.js';
import { assertTenantAccess } from './rating.access.js';

const loadElectionForRating = async (electionId) => {
  const election = await electionRepository.findElectionById(electionId);
  if (!election) throw ApiError.notFound('Elección no encontrada');
  if (!RATING_PROCESS_TYPES.includes(election.processType)) {
    throw ApiError.badRequest('Esta elección no admite calificación por rúbrica');
  }
  return election;
};

export const createCriterion = async ({ electionId, name, weight, maxScore, actor }) => {
  const election = await loadElectionForRating(electionId);
  await assertTenantAccess({ electionId, actor });

  if (!RUBRIC_CONFIGURABLE_STATUSES.includes(election.status)) {
    throw ApiError.conflict('Los criterios de evaluación solo se configuran antes de abrir la feria');
  }

  const current = await ratingRepository.sumCriteriaWeights(electionId);
  const existingWeight = Number(current?._sum?.weight ?? 0);
  const newWeight = Number(weight) || 0;

  if ((existingWeight + newWeight).toFixed(2) !== '1.00') {
    throw ApiError.badRequest(
      `La suma de pesos debe ser exactamente 1.00. Peso actual configurado: ${existingWeight.toFixed(2)}`
    );
  }

  return ratingRepository.createCriterion({
    electionId,
    name,
    weight: newWeight,
    maxScore: maxScore ?? RUBRIC_MAX_SCORE,
  });
};

export const getCriteria = async ({ electionId }) => {
  const elections = await electionRepository.findElectionById(electionId);
  if (!elections) throw ApiError.notFound('Elección no encontrada');
  const criteria = await ratingRepository.listCriteria(electionId);
  const weightSum = criteria.reduce((acc, c) => acc + Number(c.weight), 0);
  return {
    election_id: electionId,
    max_score: RUBRIC_MAX_SCORE,
    weight_sum: Number(weightSum.toFixed(2)),
    complete: weightSum.toFixed(2) === '1.00',
    criteria,
  };
};

export const removeCriterion = async ({ electionId, criterionId, actor }) => {
  const election = await loadElectionForRating(electionId);
  await assertTenantAccess({ electionId, actor });

  if (!RUBRIC_CONFIGURABLE_STATUSES.includes(election.status)) {
    throw ApiError.conflict('Los criterios de evaluación solo se pueden modificar antes de abrir la feria');
  }

  const criterion = await ratingRepository.findCriterion(criterionId, electionId);
  if (!criterion) throw ApiError.notFound('Criterio no encontrado');
  if (criterion.ratingDetails.length > 0) {
    throw ApiError.conflict('No puedes eliminar un criterio que ya tiene calificaciones');
  }

  try {
    await ratingRepository.deleteCriterion(criterionId);
    return { deleted: true };
  } catch (err) {
    if (err?.code === 'P2025') throw ApiError.notFound('Criterio no encontrado');
    throw err;
  }
};
