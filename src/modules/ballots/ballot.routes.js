// src/modules/ballots/ballot.routes.js
// S5-07 — Router principal del módulo Ballots.

import { Router } from 'express';

import * as ballotController from './ballot.controller.js';

import ballotPositionRoutes from './ballotPosition.routes.js';

import {
  authenticate,
  authorize,
} from '../../middlewares/auth.middleware.js';

import { validate } from '../../middlewares/validate.middleware.js';

import { ROLES } from '../../constants/roles.js';

import {
  ballotParamsSchema,
  electionBallotParamsSchema,
  listBallotSchema,
  createBallotSchema,
  updateBallotSchema,
  validateCompletenessSchema,
} from './ballot.schema.js';

const router = Router();

const GESTORES = [
  ROLES.ADMIN,
  ROLES.ELECTORAL_COMMISSION,
];

// ─────────────────────────────────────────
// Funciones especiales
// ─────────────────────────────────────────

router.get(
  '/election/:electionId/active',
  authenticate,
  validate(electionBallotParamsSchema),
  ballotController.getActiveBallot,
);

router.post(
  '/election/:electionId/version',
  authenticate,
  authorize(GESTORES),
  validate(electionBallotParamsSchema),
  ballotController.createBallotVersion,
);

router.get(
  '/:id/completeness',
  authenticate,
  validate(validateCompletenessSchema),
  ballotController.validateBallotCompleteness,
);

// ─────────────────────────────────────────
// Posiciones anidadas
// ─────────────────────────────────────────

router.use(
  '/:ballotId/positions',
  ballotPositionRoutes,
);

// ─────────────────────────────────────────
// CRUD Ballots
// ─────────────────────────────────────────

router.get(
  '/',
  authenticate,
  validate(listBallotSchema),
  ballotController.listBallots,
);

router.get(
  '/:id',
  authenticate,
  validate(ballotParamsSchema),
  ballotController.getBallotById,
);

router.post(
  '/',
  authenticate,
  authorize(GESTORES),
  validate(createBallotSchema),
  ballotController.createBallot,
);

router.put(
  '/:id',
  authenticate,
  authorize(GESTORES),
  validate(updateBallotSchema),
  ballotController.updateBallot,
);

router.delete(
  '/:id',
  authenticate,
  authorize(GESTORES),
  validate(ballotParamsSchema),
  ballotController.deleteBallot,
);

export default router;