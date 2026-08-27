// src/modules/elections/candidacy.routes.js
// S4-12 — Rutas de candidaturas, anidadas bajo
//         /api/elections/:electionId/candidacies

import { Router } from 'express';
import * as candidacyController from './candidacy.controller.js';
import { authenticate, authorize } from '../../../middlewares/auth.middleware.js';
import { validate } from '../../../middlewares/validate.middleware.js';
import { ROLES } from '../../../constants/roles.js';
import {
  listCandidacySchema,
  candidacyParamsSchema,
  createCandidacySchema,
  updateCandidacySchema,
} from './candidacy.schema.js';

const router = Router({ mergeParams: true });

const GESTORES = [ROLES.ADMIN, ROLES.ELECTORAL_COMMISSION];

router.get(
  '/',
  authenticate,
  validate(listCandidacySchema),
  candidacyController.listCandidacies
);

router.get(
  '/:id',
  authenticate,
  validate(candidacyParamsSchema),
  candidacyController.getCandidacyById
);

router.post(
  '/',
  authenticate,
  authorize(GESTORES),
  validate(createCandidacySchema),
  candidacyController.createCandidacy
);

router.put(
  '/:id',
  authenticate,
  authorize(GESTORES),
  validate(updateCandidacySchema),
  candidacyController.updateCandidacy
);

router.delete(
  '/:id',
  authenticate,
  authorize(GESTORES),
  validate(candidacyParamsSchema),
  candidacyController.deleteCandidacy
);

router.patch(
  '/:id',
  authenticate,
  authorize(GESTORES),
  validate(updateCandidacySchema),
  candidacyController.updateCandidacy
);

export default router;
