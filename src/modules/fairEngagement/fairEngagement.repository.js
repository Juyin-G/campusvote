// src/modules/fairEngagement/fairEngagement.repository.js
// Acceso a datos (Prisma) — likes, comments, milestones.

import { prisma } from '../../database/prisma.js';

export const findLike = (fairId, projectId, juryUserId) =>
  prisma.fairProjectLike.findUnique({
    where: { projectId_juryUserId: { projectId, juryUserId } },
  });

export const createLike = ({ fairId, projectId, juryUserId }) =>
  prisma.fairProjectLike.create({ data: { fairId, projectId, juryUserId } });

export const deleteLike = (likeId) =>
  prisma.fairProjectLike.delete({ where: { id: likeId } });

export const countLikesByProject = (projectId) =>
  prisma.fairProjectLike.count({ where: { projectId } });

export const countLikesByProjectBatch = async (projectIds) => {
  if (!projectIds || projectIds.length === 0) return new Map();
  const grouped = await prisma.fairProjectLike.groupBy({
    by: ['projectId'],
    where: { projectId: { in: projectIds } },
    _count: { _all: true },
  });
  return new Map(grouped.map((g) => [g.projectId, g._count._all]));
};

export const listComments = (projectId) =>
  prisma.fairProjectComment.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
    include: {
      jury: { select: { id: true, firstName: true, lastName: true, institutionalId: true } },
    },
  });

export const findComment = (commentId) =>
  prisma.fairProjectComment.findUnique({ where: { id: commentId } });

export const createComment = ({ fairId, projectId, juryUserId, comment, isAnonymous }) =>
  prisma.fairProjectComment.create({
    data: { fairId, projectId, juryUserId, comment, isAnonymous },
    include: {
      jury: { select: { id: true, firstName: true, lastName: true, institutionalId: true } },
    },
  });

export const updateComment = (commentId, data) =>
  prisma.fairProjectComment.update({ where: { id: commentId }, data });

export const deleteComment = (commentId) =>
  prisma.fairProjectComment.delete({ where: { id: commentId } });

/** Devuelve los hitos ya notificados para un proyecto. */
export const listNotifiedMilestones = async (projectId) => {
  const rows = await prisma.fairProjectLikeMilestone.findMany({
    where: { projectId },
    select: { milestone: true },
  });
  return new Set(rows.map((r) => r.milestone));
};

/** Marca un hito como notificado (idempotente: UNIQUE (project_id, milestone)). */
export const markMilestoneNotified = (projectId, milestone) =>
  prisma.fairProjectLikeMilestone.create({ data: { projectId, milestone } });

export default {
  findLike,
  createLike,
  deleteLike,
  countLikesByProject,
  countLikesByProjectBatch,
  listComments,
  findComment,
  createComment,
  updateComment,
  deleteComment,
  listNotifiedMilestones,
  markMilestoneNotified,
};
