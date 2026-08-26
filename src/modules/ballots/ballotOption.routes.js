// src/modules/ballots/ballotOption.routes.js
// S5-07 — Rutas de opciones de boleta.

import { Router } from 'express';

import * as ballotOptionController from './ballotOption.controller.js';

import {
  authenticate,
  authorize,
} from '../../middlewares/auth.middleware.js';

import { validate } from '../../middlewares/validate.middleware.js';

import { ROLES } from '../../constants/roles.js';

import {
  listBallotOptionSchema,
  ballotOptionParamsSchema,
  createBallotOptionSchema,
  updateBallotOptionSchema,
} from './ballotOption.schema.js';

const router = Router({
  mergeParams: true,
});

const GESTORES = [
  ROLES.ADMIN,
  ROLES.ELECTORAL_COMMISSION,
];

router.get(
  '/',
  authenticate,
  validate(listBallotOptionSchema),
  ballotOptionController.listBallotOptions,
);

router.get(
  '/:id',
  authenticate,
  validate(ballotOptionParamsSchema),
  ballotOptionController.getBallotOptionById,
);

router.post(
  '/',
  authenticate,
  authorize(GESTORES),
  validate(createBallotOptionSchema),
  ballotOptionController.createBallotOption,
);

router.put(
  '/:id',
  authenticate,
  authorize(GESTORES),
  validate(updateBallotOptionSchema),
  ballotOptionController.updateBallotOption,
);

router.delete(
  '/:id',
  authenticate,
  authorize(GESTORES),
  validate(ballotOptionParamsSchema),
  ballotOptionController.deleteBallotOption,
);

export default router;