// src/modules/fairEngagement/fairEngagement.likes.service.js
// Me gusta del jurado sobre un proyecto (POST = like, DELETE = unlike).
// POST/DELETE explícitos (no toggle ambiguo). 1 like por jurado/proyecto.

import * as engagementRepository from './fairEngagement.repository.js';
import * as juryAssignmentRepository from '../juryAssignments/juryAssignment.repository.js';
import projectRepository from '../projects/project.repository.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { ROLES } from '../../constants/roles.js';
import { mapLike } from './fairEngagement.helpers.js';
import {
  notifyProjectLiked,
  notifyLikeMilestoneIfReached,
} from './fairEngagement.notifications.js';

const assertJuryAssignedToFair = async (fairId, juryUserId) => {
  const a = await juryAssignmentRepository.findByFairUser(fairId, juryUserId);
  if (!a) throw ApiError.forbidden('No tienes asignación como jurado en esta feria');
};

const assertProjectInFairApproved = async (fairId, projectId) => {
  const project = await projectRepository.findById(projectId);
  if (!project || project.fairId !== fairId) {
    throw ApiError.notFound('Proyecto no encontrado en esta feria');
  }
  if (project.status !== 'APPROVED') {
    throw ApiError.conflict('Solo se puede interactuar con proyectos aprobados');
  }
  return project;
};

const assertJuryRole = (actor) => {
  if (actor.role !== ROLES.JURY) {
    throw ApiError.forbidden('Solo los usuarios con rol JURY pueden dar Me gusta');
  }
};

/** POST /api/fairs/:fairId/projects/:projectId/like — marca Me gusta. */
export const likeProject = async ({ fairId, projectId, actor }) => {
  assertJuryRole(actor);
  await assertJuryAssignedToFair(fairId, actor.id);
  const project = await assertProjectInFairApproved(fairId, projectId);

  // Idempotente: si ya existe, devolvemos el like actual sin error.
  const existing = await engagementRepository.findLike(fairId, projectId, actor.id);
  if (existing) {
    const count = await engagementRepository.countLikesByProject(projectId);
    return {
      like: mapLike(existing),
      count,
      has_liked: true,
      already_liked: true,
    };
  }

  let like;
  try {
    like = await engagementRepository.createLike({
      fairId,
      projectId,
      juryUserId: actor.id,
    });
  } catch (error) {
    // El disparador de 013_fair_engagement rechaza con RAISE EXCEPTION
    // (P0001) si la feria no está OPEN: es un conflicto de estado, no un 500.
    if (error?.meta?.code === 'P0001' || /P0001/.test(String(error?.message))) {
      throw ApiError.conflict('Solo se puede dar like mientras la feria está abierta (OPEN)');
    }
    throw error;
  }

  const count = await engagementRepository.countLikesByProject(projectId);

  // Notificación al expositor + chequeo de hito (dedupe en BD).
  await notifyProjectLiked({
    fairId,
    projectId,
    juryUserId: actor.id,
    projectName: project.name,
  });
  await notifyLikeMilestoneIfReached({ fairId, projectId, newCount: count, projectName: project.name });

  return { like: mapLike(like), count, has_liked: true, already_liked: false };
};

/** DELETE /api/fairs/:fairId/projects/:projectId/like — quita Me gusta. */
export const unlikeProject = async ({ fairId, projectId, actor }) => {
  assertJuryRole(actor);
  await assertJuryAssignedToFair(fairId, actor.id);

  const existing = await engagementRepository.findLike(fairId, projectId, actor.id);
  if (!existing) {
    // Idempotente: no había like → 204 semántico (count nuevo).
    const count = await engagementRepository.countLikesByProject(projectId);
    return { count, has_liked: false, removed: false };
  }

  await engagementRepository.deleteLike(existing.id);
  const count = await engagementRepository.countLikesByProject(projectId);
  return { count, has_liked: false, removed: true };
};

/**
 * GET /api/fairs/:fairId/projects/:projectId/likes/count
 * Para JURY: devuelve count + hasLiked (si este jurado dio Me gusta).
 * Para otros roles: devuelve solo count.
 */
export const getLikeStatus = async ({ fairId, projectId, actor }) => {
  await assertProjectInFairApproved(fairId, projectId);
  const count = await engagementRepository.countLikesByProject(projectId);
  const isJury = actor?.role === ROLES.JURY;
  let hasLiked = false;
  if (isJury && actor?.id) {
    const existing = await engagementRepository.findLike(fairId, projectId, actor.id);
    hasLiked = Boolean(existing);
  }
  return { count, has_liked: hasLiked };
};
