// src/modules/fairEngagement/fairEngagement.controller.js
// Capa HTTP del módulo de engagement.

import * as likesService from './fairEngagement.likes.service.js';
import * as commentsService from './fairEngagement.comments.service.js';
import asyncHandler from '../../shared/utils/asyncHandler.js';
import { sendCreated, sendSuccess, sendPaginated } from '../../shared/utils/apiResponse.js';
import { HTTP_STATUS } from '../../constants/httpStatus.js';

const actorId = (user) => user?.userId ?? user?.id;
const getActor = (user) => ({
  id: actorId(user) || user?.id,
  role: user?.role,
  organizationId: user?.organizationId || null,
  firstName: user?.firstName,
  lastName: user?.lastName,
  institutionalId: user?.institutionalId,
});

// ── Likes ─────────────────────────────────────────────────────────────

export const likeProject = asyncHandler(async (req, res) =>
  sendCreated(
    res,
    await likesService.likeProject({
      fairId: req.params.fairId,
      projectId: req.params.projectId,
      actor: getActor(req.user),
    }),
    'Me gusta registrado'
  )
);

export const unlikeProject = asyncHandler(async (req, res) =>
  sendSuccess(
    res,
    await likesService.unlikeProject({
      fairId: req.params.fairId,
      projectId: req.params.projectId,
      actor: getActor(req.user),
    }),
    'Me gusta eliminado',
    {},
    HTTP_STATUS.OK
  )
);

export const getLikeStatus = asyncHandler(async (req, res) =>
  sendSuccess(
    res,
    await likesService.getLikeStatus({
      fairId: req.params.fairId,
      projectId: req.params.projectId,
      actor: getActor(req.user),
    }),
    'Estado de Me gusta',
    {},
    HTTP_STATUS.OK
  )
);

// ── Comments ──────────────────────────────────────────────────────────

export const createComment = asyncHandler(async (req, res) =>
  sendCreated(
    res,
    await commentsService.createComment({
      fairId: req.params.fairId,
      projectId: req.params.projectId,
      data: req.body,
      actor: getActor(req.user),
    }),
    'Comentario registrado'
  )
);

export const listComments = asyncHandler(async (req, res) => {
  const result = await commentsService.listComments({
    fairId: req.params.fairId,
    projectId: req.params.projectId,
    actor: getActor(req.user),
  });
  return sendPaginated(res, result, { page: 1, limit: 100, total: result.length }, 'Comentarios');
});

export const updateComment = asyncHandler(async (req, res) =>
  sendSuccess(
    res,
    await commentsService.updateComment({
      fairId: req.params.fairId,
      commentId: req.params.commentId,
      data: req.body,
      actor: getActor(req.user),
    }),
    'Comentario actualizado',
    {},
    HTTP_STATUS.OK
  )
);

export const deleteComment = asyncHandler(async (req, res) =>
  sendSuccess(
    res,
    await commentsService.deleteComment({
      fairId: req.params.fairId,
      commentId: req.params.commentId,
      actor: getActor(req.user),
    }),
    'Comentario eliminado',
    {},
    HTTP_STATUS.OK
  )
);

export default {
  likeProject,
  unlikeProject,
  getLikeStatus,
  createComment,
  listComments,
  updateComment,
  deleteComment,
};
