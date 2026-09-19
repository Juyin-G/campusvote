// src/modules/ratings/rating.lifecycle.service.js
// Calificación de proyectos + revocación/restauración administrativa.

import * as ratingRepository from './rating.repository.js';
import * as electionRepository from '../elections/elections/election.repository.js';
import * as notificationService from '../notification/notification.service.js';
import { prisma } from '../../database/prisma.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import auditService from '../audit/audit.service.js';
import logger from '../../config/logger.js';
import {
  RATING_PROCESS_TYPES,
  RATING_ALLOWED_STATUS,
} from './rating.constants.js';
import { assertTenantAccess } from './rating.access.js';
import {
  assertJurorAssignment,
  assertNoConflictOfInterest,
  computeWeightedScore,
} from './rating.helpers.js';

const loadElectionForRating = async (electionId) => {
  const election = await electionRepository.findElectionById(electionId);
  if (!election) throw ApiError.notFound('Elección no encontrada');
  if (!RATING_PROCESS_TYPES.includes(election.processType)) {
    throw ApiError.badRequest('Esta elección no admite calificación por rúbrica');
  }
  return election;
};

/**
 * Un jurado califica un proyecto con la rúbrica completa.
 * `score` (final ponderado) se calcula aquí: nunca se confía en el cliente.
 */
export const rateProject = async ({ electionId, candidacyId, details, comment, actor }) => {
  const election = await loadElectionForRating(electionId);
  await assertTenantAccess({ electionId, actor });

  if (!RATING_ALLOWED_STATUS.includes(election.status)) {
    throw ApiError.conflict('Las calificaciones solo se aceptan mientras la feria está abierta');
  }

  const candidacy = await prisma.candidacy.findUnique({
    where: { id: candidacyId },
    select: { id: true, electionId: true, status: true, userId: true, candidateListId: true, advisorId: true },
  });
  if (!candidacy) throw ApiError.notFound('Proyecto/candidatura no encontrada');
  if (candidacy.electionId !== electionId) {
    throw ApiError.badRequest('La candidatura no pertenece a esta elección');
  }

  await assertJurorAssignment({ prisma, electionId, candidacyId, jurorId: actor.id });
  await assertNoConflictOfInterest({ prisma, electionId, jurorId: actor.id, candidacyId });

  // Una calificación REVOKED NO se resucita por re-subida del jurado.
  const existingRating = await ratingRepository.findRating(candidacyId, actor.id);
  if (existingRating?.status === 'REVOKED') {
    throw ApiError.conflict(
      'Esta calificación fue revocada por la comisión. Contacta a la comisión electoral para su revisión antes de recalificar.'
    );
  }

  const { finalScore, details: normalizedDetails } = await computeWeightedScore({
    ratingRepository,
    electionId,
    details,
  });

  const rating = await ratingRepository.upsertRating({
    electionId,
    candidacyId,
    jurorId: actor.id,
    score: finalScore,
    comment: comment || null,
    details: normalizedDetails,
  });

  try {
    const project = await prisma.candidateList.findUnique({
      where: { id: candidacy.candidateListId },
      select: { name: true },
    });
    await notificationService.createNotification({
      user_id: candidacy.userId,
      type: 'RATING_RECEIVED',
      title: '¡Tu proyecto fue evaluado!',
      message: `${project?.name || 'Tu proyecto'} recibió una nueva evaluación de la feria`,
      metadata: { election_id: electionId, candidacy_id: candidacyId, score: finalScore },
      channels: ['IN_APP', 'PUSH'],
    });
  } catch (err) {
    logger.warn('No se pudo notificar al expositor del rating', { error: err.message });
  }

  try {
    await auditService.logAction({
      actorId: actor.id,
      electionId,
      action: 'SUBMIT_RATING',
      metadata: { rating_id: rating.id, candidacy_id: candidacyId, score: finalScore },
    });
  } catch (err) {
    logger.warn('No se pudo registrar la calificación en auditoría', { error: err.message });
  }

  return rating;
};

/** Revocación administrativa (ADMIN). */
export const revokeRating = async ({ electionId, ratingId, reason, actor }) => {
  await loadElectionForRating(electionId);
  await assertTenantAccess({ electionId, actor });

  const rating = await ratingRepository.findRatingById(ratingId, electionId);
  if (!rating) throw ApiError.notFound('Calificación no encontrada en esta elección');
  if (rating.status === 'REVOKED') {
    throw ApiError.conflict('La calificación ya está revocada');
  }

  const revoked = await ratingRepository.updateRatingStatus(ratingId, 'REVOKED');
  try {
    await auditService.logAction({
      actorId: actor.id,
      electionId,
      action: 'REVOKE_RATING',
      metadata: { rating_id: ratingId, juror_id: rating.jurorId, reason },
    });
  } catch (err) {
    logger.warn('No se pudo registrar la revocación en auditoría', { error: err.message });
  }

  return { ...revoked, revoked: true, reason };
};

/** Reactivación administrativa de un REVOKED. */
export const restoreRating = async ({ electionId, ratingId, actor }) => {
  await loadElectionForRating(electionId);
  await assertTenantAccess({ electionId, actor });

  const rating = await ratingRepository.findRatingById(ratingId, electionId);
  if (!rating) throw ApiError.notFound('Calificación no encontrada en esta elección');
  if (rating.status !== 'REVOKED') {
    throw ApiError.conflict('Solo se pueden restaurar calificaciones revocadas');
  }

  const restored = await ratingRepository.updateRatingStatus(ratingId, 'ACTIVE');
  try {
    await auditService.logAction({
      actorId: actor.id,
      electionId,
      action: 'RESTORE_RATING',
      metadata: { rating_id: ratingId, juror_id: rating.jurorId },
    });
  } catch (err) {
    logger.warn('No se pudo registrar la restauración en auditoría', { error: err.message });
  }

  return { ...restored, restored: true };
};
