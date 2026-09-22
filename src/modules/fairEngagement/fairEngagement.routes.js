// src/modules/fairEngagement/fairEngagement.routes.js
// Endpoints del módulo de engagement (Me gusta + comentarios).
// JURY: like/unlike + comments en proyectos asignados.
// STUDENT (integrante): GET comments en su proyecto (anonimato).
// ADMIN: GET comments (con autor).

import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { ROLES } from '../../constants/roles.js';
import * as fairEngagementController from './fairEngagement.controller.js';
import * as fairEngagementStudentController from './fairEngagement.student.controller.js';
import {
  likeSchema,
  unlikeSchema,
  likeStatusSchema,
  createCommentSchema,
  listCommentsSchema,
  updateCommentSchema,
  deleteCommentSchema,
} from './fairEngagement.schema.js';

const router = Router();

const JURY_ONLY = [ROLES.JURY];

// ── Likes ─────────────────────────────────────────────────────────────

// POST — marcar Me gusta (idempotente).
router.post(
  '/:fairId/projects/:projectId/like',
  authenticate,
  authorize(JURY_ONLY),
  validate(likeSchema),
  fairEngagementController.likeProject
);

// DELETE — quitar Me gusta (idempotente).
router.delete(
  '/:fairId/projects/:projectId/like',
  authenticate,
  authorize(JURY_ONLY),
  validate(unlikeSchema),
  fairEngagementController.unlikeProject
);

// GET — estado del Me gusta (count + has_liked para JURY; solo count para otros).
router.get(
  '/:fairId/projects/:projectId/likes/count',
  authenticate,
  validate(likeStatusSchema),
  fairEngagementController.getLikeStatus
);

// GET — engagement integrado para integrantes del proyecto (estudiantes).
router.get(
  '/:fairId/projects/:projectId/engagement',
  authenticate,
  validate(likeStatusSchema),
  fairEngagementStudentController.getEngagement
);

// ── Comments ──────────────────────────────────────────────────────────

router.post(
  '/:fairId/projects/:projectId/comments',
  authenticate,
  authorize(JURY_ONLY),
  validate(createCommentSchema),
  fairEngagementController.createComment
);

router.get(
  '/:fairId/projects/:projectId/comments',
  authenticate,
  validate(listCommentsSchema),
  fairEngagementController.listComments
);

router.patch(
  '/:fairId/comments/:commentId',
  authenticate,
  validate(updateCommentSchema),
  fairEngagementController.updateComment
);

router.delete(
  '/:fairId/comments/:commentId',
  authenticate,
  validate(deleteCommentSchema),
  fairEngagementController.deleteComment
);

export default router;
