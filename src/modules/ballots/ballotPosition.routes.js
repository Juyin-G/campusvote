// src/modules/ballots/ballotPosition.routes.js
// S5-07 — Rutas de posiciones dentro de una boleta.

import { Router } from 'express';

import * as ballotPositionController from './ballotPosition.controller.js';

import ballotOptionRoutes from './ballotOption.routes.js';

import {
  authenticate,
  authorize,
} from '../../middlewares/auth.middleware.js';

import { validate } from '../../middlewares/validate.middleware.js';

import { ROLES } from '../../constants/roles.js';

import {
  listBallotPositionSchema,
  ballotPositionParamsSchema,
  createBallotPositionSchema,
  updateBallotPositionSchema,
} from './ballotPosition.schema.js';

const router = Router({
  mergeParams: true,
});

const GESTORES = [
  ROLES.ADMIN,
  ROLES.ELECTORAL_COMMISSION,
];

// Subrecurso de opciones
router.use(
  '/:ballotPositionId/options',
  ballotOptionRoutes,
);

router.get(
  '/',
  authenticate,
  validate(listBallotPositionSchema),
  ballotPositionController.listBallotPositions,
);

router.get(
  '/:id',
  authenticate,
  validate(ballotPositionParamsSchema),
  ballotPositionController.getBallotPositionById,
);

router.post(
  '/',
  authenticate,
  authorize(GESTORES),
  validate(createBallotPositionSchema),
  ballotPositionController.createBallotPosition,
);

router.put(
  '/:id',
  authenticate,
  authorize(GESTORES),
  validate(updateBallotPositionSchema),
  ballotPositionController.updateBallotPosition,
);

router.delete(
  '/:id',
  authenticate,
  authorize(GESTORES),
  validate(ballotPositionParamsSchema),
  ballotPositionController.deleteBallotPosition,
);

export default router;