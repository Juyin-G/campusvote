// src/modules/ratings/rating.routes.js
// Rúbrica multicriterio (ferias) y asignación de jurados (doble ciego).
// Rutas bajo /elections/:id para respetar el patrón del resto del módulo.

import { Router } from 'express';
import * as ratingController from './rating.controller.js';
import asyncHandler from '../../shared/utils/asyncHandler.js';
import { authenticate, authorize } from '../../middlewares/auth.middleware.js';
import { requireElectionInScope } from '../../middlewares/scope.middleware.js';
import { userElectionLimiter } from '../../middlewares/rateLimiter.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { ROLES } from '../../constants/roles.js';
import {
  rateProjectSchema,
  createCriterionSchema,
  listCriteriaSchema,
  deleteCriterionSchema,
  electionIdParamSchema,
  listRatingsSchema,
  revokeRatingSchema,
  restoreRatingSchema,
} from './rating.schema.js';

import * as juryController from './juryAssignment.controller.js';
import {
  assignJurySchema,
  approveJurySchema,
  signConflictSchema,
  listAssignmentsSchema,
} from './juryAssignment.schema.js';

const router = Router();

// Scoring roles: JURY (cuando está asignado a un proyecto) + ADMIN + SUPERADMIN.
// ELECTORAL_COMMISSION eliminado: el rol de configuración pertenece solo a ADMIN.
const SCORERS = [ROLES.JURY, ROLES.ADMIN, ROLES.SUPERADMIN];
const VIEWERS = [
  ROLES.JURY,
  ROLES.ADMIN,
  ROLES.SUPERADMIN,
  ROLES.TEACHER,
  ROLES.STUDENT,
];
const CONFIGURERS = [ROLES.ADMIN, ROLES.SUPERADMIN];

// ── CRITERIOS DE RÚBRICA ──────────────────────────────────────────
router.post(
  '/elections/:id/criteria',
  authenticate,
  authorize(CONFIGURERS),
  validate(createCriterionSchema),
  asyncHandler(requireElectionInScope),
  asyncHandler(ratingController.createCriterion)
);

router.get(
  '/elections/:id/criteria',
  authenticate,
  authorize(VIEWERS),
  validate(listCriteriaSchema),
  asyncHandler(requireElectionInScope),
  asyncHandler(ratingController.getCriteria)
);

router.delete(
  '/elections/:id/criteria/:criterionId',
  authenticate,
  authorize(CONFIGURERS),
  validate(deleteCriterionSchema),
  asyncHandler(requireElectionInScope),
  asyncHandler(ratingController.removeCriterion)
);

// ── ASIGNACIÓN DE JURADOS (doble ciego) ───────────────────────────
router.post(
  '/elections/:id/jury-assignments',
  authenticate,
  authorize(CONFIGURERS),
  validate(assignJurySchema),
  asyncHandler(requireElectionInScope),
  asyncHandler(juryController.assignJury)
);

router.get(
  '/elections/:id/jury-assignments',
  authenticate,
  authorize(SCORERS.concat(VIEWERS).filter((r, i, a) => a.indexOf(r) === i)),
  validate(listAssignmentsSchema),
  asyncHandler(requireElectionInScope),
  asyncHandler(juryController.listAssignments)
);

router.put(
  '/elections/:id/jury-assignments/:assignmentId/status',
  authenticate,
  authorize(CONFIGURERS),
  validate(approveJurySchema),
  asyncHandler(requireElectionInScope),
  asyncHandler(juryController.setAssignmentStatus)
);

router.post(
  '/elections/:id/jury-assignments/:assignmentId/declaration',
  authenticate,
  authorize([ROLES.JURY]),
  validate(signConflictSchema),
  asyncHandler(requireElectionInScope),
  asyncHandler(juryController.signConflictDeclaration)
);

// ── CALIFICACIÓN ──────────────────────────────────────────────────
router.post(
  '/elections/:id/ratings/:candidacyId',
  authenticate,
  authorize(SCORERS),
  userElectionLimiter({ windowMs: 60 * 60 * 1000, max: 120 }),
  validate(rateProjectSchema),
  asyncHandler(requireElectionInScope),
  asyncHandler(ratingController.rateProject)
);

router.get(
  '/elections/:id/ratings/results',
  authenticate,
  authorize(VIEWERS),
  validate(electionIdParamSchema),
  asyncHandler(requireElectionInScope),
  asyncHandler(ratingController.getRatingResults)
);

router.get(
  '/elections/:id/ratings',
  authenticate,
  authorize(VIEWERS),
  validate(listRatingsSchema),
  asyncHandler(requireElectionInScope),
  asyncHandler(ratingController.listRatings)
);

// ── REVISIÓN ADMINISTRATIVA (REVOKED → ACTIVE) ──────────────────────
router.post(
  '/elections/:id/ratings/:ratingId/revoke',
  authenticate,
  authorize(CONFIGURERS),
  validate(revokeRatingSchema),
  asyncHandler(requireElectionInScope),
  asyncHandler(ratingController.revokeRating)
);

router.post(
  '/elections/:id/ratings/:ratingId/restore',
  authenticate,
  authorize(CONFIGURERS),
  validate(restoreRatingSchema),
  asyncHandler(requireElectionInScope),
  asyncHandler(ratingController.restoreRating)
);

export default router;