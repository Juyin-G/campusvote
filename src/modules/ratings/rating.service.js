// src/modules/ratings/rating.service.js
// Lógica de negocio para la calificación por estrellas en ferias/concursos.

import * as ratingRepository from './rating.repository.js';
import * as electionRepository from '../elections/elections/election.repository.js';
import * as notificationService from '../notification/notification.service.js';
import { prisma } from '../../database/prisma.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { ROLES } from '../../constants/roles.js';
import logger from '../../config/logger.js';
import * as juryRepository from '../jury/jury.repository.js';

// Tipos de proceso que admiten rating de proyectos (jurados).
const RATING_PROCESS_TYPES = ['FAIR', 'AWARD', 'EVENT_POLL'];

// Estados en los que se permite calificar.
const RATING_ALLOWED_STATUS = ['OPEN'];

/**
 * Valida que el actor sea un jurado habilitado y que la elección/candidatura
 * pertenezcan a su organización (tenant).
 */
const assertCanRate = async ({ electionId, candidacyId, actor }) => {
  const election = await electionRepository.findElectionById(electionId);
  if (!election) {
    throw ApiError.notFound('Elección no encontrada');
  }

  // Solo los procesos de concurso/feria admiten rating por estrellas.
  if (!RATING_PROCESS_TYPES.includes(election.processType)) {
    throw ApiError.badRequest('Esta elección no admite calificación por estrellas');
  }

  if (!RATING_ALLOWED_STATUS.includes(election.status)) {
    throw ApiError.conflict('Las calificaciones solo se aceptan mientras la elección está abierta');
  }

  // El jurado debe pertenecer a la misma organización que creó la elección
  // (salvo SUPERADMIN global). Tenemos el actor y la org del creador.
  const isSuperAdmin =
    actor.role === ROLES.SUPERADMIN || actor.isSuperAdmin || actor.isSuperuser;

  if (!isSuperAdmin) {
    if (!actor.organizationId) {
      throw ApiError.forbidden('Tu cuenta no está vinculada a ninguna organización');
    }
    const ownerOrgId = await electionRepository.findElectionOwnerOrganization(electionId);
    if (ownerOrgId && ownerOrgId !== actor.organizationId) {
      throw ApiError.forbidden('La elección no pertenece a tu organización');
    }
  }

  // La candidatura/proyecto debe pertenecer a la elección.
  const candidacy = await prisma.candidacy.findUnique({
    where: { id: candidacyId },
    select: { id: true, electionId: true, status: true, userId: true, candidateListId: true },
  });
  if (!candidacy) {
    throw ApiError.notFound('Proyecto/candidatura no encontrada');
  }
  if (candidacy.electionId !== electionId) {
    throw ApiError.badRequest('La candidatura no pertenece a esta elección');
  }

  if (!isSuperAdmin && actor.role === ROLES.JURY) {
    const conflict = await juryRepository.findConflict({
      electionId,
      candidacyId,
      jurorId: actor.id,
    });
    if (conflict?.status === 'OPEN') {
      throw ApiError.forbidden('No puedes calificar un proyecto con conflicto de interés abierto');
    }
    const assignment = await juryRepository.findAssignment({
      electionId,
      candidacyId,
      jurorId: actor.id,
    });
    if (assignment?.status !== 'ACTIVE') {
      throw ApiError.forbidden('No estás asignado a este proyecto');
    }
  }

  return { election, candidacy };
};

/**
 * Un jurado califica (1-5) y opcionalmente comenta un proyecto de la feria.
 * La calificación es trazable y un jurado califica una sola vez (upsert).
 */
export const rateProject = async ({ electionId, candidacyId, score, comment, actor }) => {
  const { candidacy } = await assertCanRate({ electionId, candidacyId, actor });

  const existingRating = await ratingRepository.findRating(candidacyId, actor.id);
  if (existingRating) {
    throw ApiError.conflict(
      'Ya calificaste este proyecto. Una calificación enviada no puede modificarse sin una reapertura formal.'
    );
  }

  let rating;
  try {
    rating = await ratingRepository.createRating({
      electionId,
      candidacyId,
      jurorId: actor.id,
      score,
      comment: comment || null,
    });
  } catch (error) {
    if (error?.code === 'P2002') {
      throw ApiError.conflict('Ya calificaste este proyecto');
    }
    throw error;
  }

  // Notificación precisa para la app (Flutter): el expositor recibe
  // RATING_RECEIVED con su proyecto y la calificación obtenida.
  try {
    const project = await prisma.candidateList.findUnique({
      where: { id: candidacy.candidateListId },
      select: { name: true },
    });
    await notificationService.createNotification({
      user_id: candidacy.userId,
      type: 'RATING_RECEIVED',
      title: '¡Tu proyecto recibió una nueva calificación!',
      message: `${project?.name || 'Tu proyecto'} fue calificado con ${score}★`,
      metadata: { election_id: electionId, candidacy_id: candidacyId, score },
      channels: ['IN_APP', 'PUSH'],
    });
  } catch (err) {
    // La notificación no debe romper la calificación.
    logger.warn('No se pudo notificar al expositor del rating', { error: err.message });
  }

  return rating;
};

/** Resultados de una elección de tipo rating con el promedio de estrellas por proyecto. */
export const getRatingResults = async ({ electionId, actor }) => {
  const election = await electionRepository.findElectionById(electionId);
  if (!election) {
    throw ApiError.notFound('Elección no encontrada');
  }

  const isSuperAdmin =
    actor.role === ROLES.SUPERADMIN || actor.isSuperAdmin || actor.isSuperuser;

  if (!isSuperAdmin) {
    if (!actor.organizationId) {
      throw ApiError.forbidden('Tu cuenta no está vinculada a ninguna organización');
    }
    const ownerOrgId = await electionRepository.findElectionOwnerOrganization(electionId);
    if (ownerOrgId && ownerOrgId !== actor.organizationId) {
      throw ApiError.forbidden('La elección no pertenece a tu organización');
    }
  }

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
      const s = scoreMap.get(c.id) || {
        rating_count: 0,
        average_score: 0,
        total_score: 0,
        s5: 0, s4: 0, s3: 0, s2: 0, s1: 0,
      };
      return {
        project_id: c.id,
        project_name: c.candidateList?.name || 'Proyecto',
        project_acronym: c.candidateList?.acronym || null,
        expositor_id: c.user?.id || null,
        expositor_name: c.user ? `${c.user.firstName} ${c.user.lastName}`.trim() : null,
        rating_count: s.rating_count,
        average_score: Number(s.average_score) || 0,
        total_score: s.total_score || 0,
        distribution: { '1': s.s1, '2': s.s2, '3': s.s3, '4': s.s4, '5': s.s5 },
      };
    })
    .sort((a, b) => b.average_score - a.average_score || b.total_score - a.total_score);

  return {
    election_id: electionId,
    process_type: election.processType,
    status: election.status,
    projects,
    rated_projects: projects.filter((p) => p.rating_count > 0).length,
  };
};

/** Lista las calificaciones (trazables) de una elección, opcionalmente por proyecto. */
export const listRatings = async ({ electionId, candidacyId, limit, offset, actor }) => {
  const election = await electionRepository.findElectionById(electionId);
  if (!election) {
    throw ApiError.notFound('Elección no encontrada');
  }

  const isSuperAdmin =
    actor.role === ROLES.SUPERADMIN || actor.isSuperAdmin || actor.isSuperuser;

  if (!isSuperAdmin) {
    if (!actor.organizationId) {
      throw ApiError.forbidden('Tu cuenta no está vinculada a ninguna organización');
    }
    const ownerOrgId = await electionRepository.findElectionOwnerOrganization(electionId);
    if (ownerOrgId && ownerOrgId !== actor.organizationId) {
      throw ApiError.forbidden('La elección no pertenece a tu organización');
    }
  }

  const items = await ratingRepository.listRatingsByElection({
    electionId,
    candidacyId,
    limit,
    offset,
  });
  const total = await prisma.rating.count({
    where: { electionId, ...(candidacyId ? { candidacyId } : {}) },
  });

  return { items: items.map((r) => r), total, limit: limit ?? 50, offset: offset ?? 0 };
};
