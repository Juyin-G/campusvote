// src/modules/fairVoting/fairVoting.service.js
// Lógica de negocio de la VOTACIÓN ANÓNIMA de JURADO en FERIAS.
// Separado conceptualmente de la rúbrica-checklist (fairEvaluations).
//
// Garantías:
//   - Un voto por jurado y feria (UNIQUE fair_id, jury_user_id en BD).
//   - Anonimato: el voto (fair_votes) NO contiene jury_user_id.
//     La participación (fair_vote_participation) sí lo contiene, separada.
//   - Transacción atómica: (1) validar, (2) comprobar, (3) crear voto
//     anónimo, (4) marcar participación, (5) commit.

import crypto from 'node:crypto';
import * as votingRepository from './fairVoting.repository.js';
import * as fairRepository from '../fairs/fair.repository.js';
import * as juryAssignmentRepository from '../juryAssignments/juryAssignment.repository.js';
import projectRepository, { findMember } from '../projects/project.repository.js';
import { hasFairStarted } from '../fairs/fair.registration.js';
import { assertNoConflictOfInterest } from '../fairEvaluations/fairEvaluation.access.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { ROLES } from '../../constants/roles.js';
import { generateReceiptCode, mapCastReceipt, mapVotingStatus } from './fairVoting.helpers.js';
import auditService from '../audit/audit.service.js';
import logger from '../../config/logger.js';
import { assertJuryCanOperateOnProject } from '../../shared/helpers/juryCategoryAccess.js';

const VOTING_STATUS = ['OPEN'];
const EVALUABLE_PROJECT_STATUS = ['APPROVED'];

// ── Helpers de acceso ─────────────────────────────────────────────

const loadFair = async (fairId) => {
  const fair = await fairRepository.findById(fairId);
  if (!fair) throw ApiError.notFound('Feria no encontrada');
  return fair;
};

const assertJuryAssignedToFair = async ({ fairId, juryId }) => {
  const a = await juryAssignmentRepository.findByFairUser(fairId, juryId);
  if (!a) throw ApiError.forbidden('No tienes asignación como jurado en esta feria');
  return a;
};

const assertVotingPeriod = (fair) => {
  if (!VOTING_STATUS.includes(fair.status)) {
    throw ApiError.conflict('Solo se puede votar mientras la feria está abierta (OPEN)');
  }
  // Igual que la rúbrica: el jurado vota sobre lo que vio en la feria.
  if (!hasFairStarted(fair)) {
    throw ApiError.conflict('La votación empieza cuando inicia la feria');
  }
};

const assertJuryRole = (actor) => {
  if (actor.role !== ROLES.JURY) {
    throw ApiError.forbidden('Solo los usuarios con rol JURY pueden votar');
  }
};

// ── Auditoría (anonimato forzado: NO guardar jury_user_id + project_id juntos)

const auditCastVote = async ({ fairId, receiptCode }) => {
  try {
    await auditService.logAction({
      actorId: null,
      electionId: null,
      action: 'CAST_FAIR_VOTE',
      metadata: { fair_id: fairId, receipt: receiptCode },
    });
  } catch (err) {
    logger.warn('No se pudo registrar voto de feria en auditoría', { error: err.message });
  }
};

const auditVoteAttempt = async ({ fairId, reason, actorId }) => {
  try {
    await auditService.logAction({
      actorId,
      electionId: null,
      action: 'FAIR_VOTE_ATTEMPT_DENIED',
      metadata: { fair_id: fairId, reason },
    });
  } catch (err) {
    logger.warn('No se pudo registrar intento de voto en auditoría', { error: err.message });
  }
};

// ── Cast vote (transaccional) ─────────────────────────────────────

/**
 * Emite el voto del JURY autenticado por un proyecto APPROVED de la feria.
 * - Una transacción Prisma garantiza atomicidad (voto + participación).
 * - UNIQUE (fair_id, jury_user_id) en participación evita doble voto
 *   incluso bajo concurrencia (defensa de BD, no solo de aplicación).
 */
export const castVote = async ({ fairId, data, actor }) => {
  assertJuryRole(actor);

  const fair = await loadFair(fairId);
  assertVotingPeriod(fair);
  await assertJuryAssignedToFair({ fairId, juryId: actor.id });

  // Verificar que el JURY puede operar sobre este proyecto (categoría).
  await assertJuryCanOperateOnProject({ fairId, projectId: data.project_id, actor });

  const project = await projectRepository.findById(data.project_id);
  if (!project) {
    await auditVoteAttempt({ fairId, reason: 'PROJECT_NOT_FOUND', actorId: actor.id });
    throw ApiError.notFound('Proyecto no encontrado');
  }
  if (project.fairId !== fairId) {
    await auditVoteAttempt({ fairId, reason: 'PROJECT_NOT_IN_FAIR', actorId: actor.id });
    throw ApiError.badRequest('El proyecto no pertenece a esta feria');
  }
  if (!EVALUABLE_PROJECT_STATUS.includes(project.status)) {
    await auditVoteAttempt({ fairId, reason: 'PROJECT_NOT_APPROVED', actorId: actor.id });
    throw ApiError.conflict('Solo se puede votar por proyectos aprobados (APPROVED)');
  }
  await assertNoConflictOfInterest({ project, actor, findMember });

  // Comprobación previa (rápida) — pero la BD es la garantía real.
  const existing = await votingRepository.findParticipation(fairId, actor.id);
  if (existing) {
    await auditVoteAttempt({ fairId, reason: 'ALREADY_VOTED', actorId: actor.id });
    throw ApiError.conflict('Ya has emitido tu voto en esta feria');
  }

  const receiptCode = generateReceiptCode();

  try {
    await votingRepository.handlePrismaError; // (mantiene import vivo en tests)
    // Transacción: voto + participación en la misma operación atómica.
    const prisma = (await import('../../database/prisma.js')).prisma;
    await prisma.$transaction(async (tx) => {
      await tx.fairVote.create({
        data: { fairId, projectId: data.project_id, receiptCode },
        select: { id: true },
      });
      await tx.fairVoteParticipation.create({
        data: { fairId, juryUserId: actor.id, votedAt: new Date() },
        select: { id: true },
      });
    });
  } catch (err) {
    if (err.message === 'FAIR_VOTE_ALREADY_VOTED') {
      await auditVoteAttempt({ fairId, reason: 'ALREADY_VOTED_RACE', actorId: actor.id });
      throw ApiError.conflict('Ya has emitido tu voto en esta feria');
    }
    if (err.message === 'FAIR_VOTE_FOREIGN_KEY') {
      await auditVoteAttempt({ fairId, reason: 'FK_VIOLATION', actorId: actor.id });
      throw ApiError.badRequest('La feria o el proyecto no son válidos');
    }
    // P2002 sobre UNIQUE fair_id, jury_user_id → carrera concurrente
    if (err?.code === 'P2002') {
      await auditVoteAttempt({ fairId, reason: 'P2002_RACE', actorId: actor.id });
      throw ApiError.conflict('Ya has emitido tu voto en esta feria');
    }
    throw err;
  }

  await auditCastVote({ fairId, receiptCode });
  return mapCastReceipt(receiptCode);
};

// ── Status del JURY (SIN proyecto elegido) ───────────────────────

export const getVotingStatus = async ({ fairId, actor }) => {
  assertJuryRole(actor);
  const fair = await loadFair(fairId);
  await assertJuryAssignedToFair({ fairId, juryId: actor.id });

  const participation = await votingRepository.findParticipation(fairId, actor.id);
  return {
    fair_id: fairId,
    fair_status: fair.status,
    ...mapVotingStatus({ hasVoted: Boolean(participation), votedAt: participation?.votedAt ?? null }),
  };
};

export default {
  castVote,
  getVotingStatus,
};
