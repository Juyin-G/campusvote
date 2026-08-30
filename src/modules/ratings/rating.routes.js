// src/modules/ratings/rating.routes.js
// Calificación por estrellas (1-5 + comentario) de proyectos en ferias/concursos.
// Los jurados califican proyectos; el promedio alimenta los resultados.

import { Router } from 'express';
import * as ratingController from './rating.controller.js';
import asyncHandler from '../../shared/utils/asyncHandler.js';
import { authenticate, authorize } from '../../middlewares/auth.middleware.js';
import { requireElectionInScope } from '../../middlewares/scope.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { ROLES } from '../../constants/roles.js';
import {
  rateProjectSchema,
  electionIdParamSchema,
  listRatingsSchema,
} from './rating.schema.js';

const router = Router();

const SCORERS = [ROLES.JURY, ROLES.ADMIN, ROLES.ELECTORAL_COMMISSION, ROLES.SUPERADMIN];
const VIEWERS = [
  ROLES.JURY,
  ROLES.ADMIN,
  ROLES.ELECTORAL_COMMISSION,
  ROLES.SUPERADMIN,
  ROLES.TEACHER,
  ROLES.STUDENT,
];

// POST /api/elections/:id/ratings/:candidacyId — calificar (1-5 + comentario) un proyecto
router.post(
  '/elections/:id/ratings/:candidacyId',
  authenticate,
  authorize(SCORERS),
  validate(rateProjectSchema),
  asyncHandler(requireElectionInScope),
  asyncHandler(ratingController.rateProject)
);

// GET /api/elections/:id/ratings/results — promedio de estrellas por proyecto
router.get(
  '/elections/:id/ratings/results',
  authenticate,
  authorize(VIEWERS),
  validate(electionIdParamSchema),
  asyncHandler(requireElectionInScope),
  asyncHandler(ratingController.getRatingResults)
);

// GET /api/elections/:id/ratings — listar calificaciones trazables
router.get(
  '/elections/:id/ratings',
  authenticate,
  authorize(VIEWERS),
  validate(listRatingsSchema),
  asyncHandler(requireElectionInScope),
  asyncHandler(ratingController.listRatings)
);

export default router;
