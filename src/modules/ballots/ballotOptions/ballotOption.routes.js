// src/modules/ballots/ballotOption.routes.js

import { Router } from 'express';

import * as ballotOptionController from './ballotOption.controller.js';

import {
  authenticate,
  authorize,
} from '../../../middlewares/auth.middleware.js';

import { validate } from '../../../middlewares/validate.middleware.js';

import { ROLES } from '../../../constants/roles.js';

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