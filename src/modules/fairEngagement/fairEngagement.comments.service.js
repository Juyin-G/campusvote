// src/modules/fairEngagement/fairEngagement.comments.service.js
// CRUD de comentarios del jurado sobre un proyecto.
// Solo el autor edita/elimina sus propios comentarios. Admin puede moderar.

import * as engagementRepository from './fairEngagement.repository.js';
import * as juryAssignmentRepository from '../juryAssignments/juryAssignment.repository.js';
import projectRepository from '../projects/project.repository.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { ROLES } from '../../constants/roles.js';
import {
  cleanComment,
  COMMENT_MAX_LENGTH,
  COMMENT_MIN_LENGTH,
  mapCommentForJury,
  mapCommentForStudent,
} from './fairEngagement.helpers.js';
import { notifyProjectCommented } from './fairEngagement.notifications.js';

const assertJuryRole = (actor) => {
  if (actor.role !== ROLES.JURY) {
    throw ApiError.forbidden('Solo los usuarios con rol JURY pueden comentar');
  }
};

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
    throw ApiError.conflict('Solo se puede comentar proyectos aprobados');
  }
  return project;
};

const assertCommentInFair = async (comment, fairId) => {
  if (comment.fairId !== fairId) {
    throw ApiError.notFound('Comentario no encontrado en esta feria');
  }
};

/** POST /api/fairs/:fairId/projects/:projectId/comments — crea comentario. */
export const createComment = async ({ fairId, projectId, data, actor }) => {
  assertJuryRole(actor);
  await assertJuryAssignedToFair(fairId, actor.id);
  const project = await assertProjectInFairApproved(fairId, projectId);

  const comment = cleanComment(data.comment);
  if (comment.length < COMMENT_MIN_LENGTH) {
    throw ApiError.badRequest(`El comentario debe tener al menos ${COMMENT_MIN_LENGTH} caracteres`);
  }
  if (comment.length > COMMENT_MAX_LENGTH) {
    throw ApiError.badRequest(`El comentario no puede superar ${COMMENT_MAX_LENGTH} caracteres`);
  }

  const created = await engagementRepository.createComment({
    fairId,
    projectId,
    juryUserId: actor.id,
    comment,
    isAnonymous: data.is_anonymous !== false, // default true
  });

  await notifyProjectCommented({
    fairId,
    projectId,
    juryUserId: actor.id,
    projectName: project.name,
  });

  return {
    // El actor viene del JWT (sin nombres): se usan los datos del jurado de la BD.
    ...mapCommentForJury(created),
  };
};

/** GET /api/fairs/:fairId/projects/:projectId/comments — lista comentarios. */
export const listComments = async ({ fairId, projectId, actor }) => {
  await assertProjectInFairApproved(fairId, projectId);
  const rows = await engagementRepository.listComments(projectId);

  // Anonimato controlado por backend:
  // - JURY asignado → ve nombre del autor.
  // - ADMIN → ve nombre del autor.
  // - STUDENT (integrante) → ve solo el comentario (sin autor).
  // - Otros → 403.
  const isJury = actor?.role === ROLES.JURY;
  const isAdmin = actor?.role === ROLES.ADMIN;

  let assigned = false;
  if (isJury && actor?.id) {
    const a = await juryAssignmentRepository.findByFairUser(fairId, actor.id);
    assigned = Boolean(a);
  }

  if (isJury && assigned) {
    return rows.map(mapCommentForJury);
  }
  if (isAdmin) {
    return rows.map(mapCommentForJury);
  }
  // Estudiantes y otros → versión anónima.
  return rows.map(mapCommentForStudent);
};

/** PATCH /api/fairs/:fairId/comments/:commentId — edita (solo autor). */
export const updateComment = async ({ fairId, commentId, data, actor }) => {
  const comment = await engagementRepository.findComment(commentId);
  if (!comment) throw ApiError.notFound('Comentario no encontrado');
  await assertCommentInFair(comment, fairId);

  if (comment.juryUserId !== actor.id) {
    throw ApiError.forbidden('Solo el autor puede editar el comentario');
  }

  const updated = cleanComment(data.comment);
  if (updated.length < COMMENT_MIN_LENGTH) {
    throw ApiError.badRequest(`El comentario debe tener al menos ${COMMENT_MIN_LENGTH} caracteres`);
  }
  if (updated.length > COMMENT_MAX_LENGTH) {
    throw ApiError.badRequest(`El comentario no puede superar ${COMMENT_MAX_LENGTH} caracteres`);
  }

  const result = await engagementRepository.updateComment(commentId, {
    comment: updated,
    isAnonymous: data.is_anonymous !== false,
  });
  return mapCommentForJury({ ...result, jury: comment.jury });
};

/** DELETE /api/fairs/:fairId/comments/:commentId — elimina (autor o ADMIN). */
export const deleteComment = async ({ fairId, commentId, actor }) => {
  const comment = await engagementRepository.findComment(commentId);
  if (!comment) throw ApiError.notFound('Comentario no encontrado');
  await assertCommentInFair(comment, fairId);

  const isAuthor = comment.juryUserId === actor.id;
  const isAdmin = actor.role === ROLES.ADMIN;
  if (!isAuthor && !isAdmin) {
    throw ApiError.forbidden('Solo el autor o un ADMIN pueden eliminar el comentario');
  }

  await engagementRepository.deleteComment(commentId);
  return { deleted: true, id: commentId };
};
