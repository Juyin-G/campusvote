// src/modules/elections/candidateList.routes.js
// S4-12 — Rutas de listas candidatas, anidadas bajo
//         /api/elections/:electionId/candidate-lists

import { Router } from 'express';
import * as candidateListController from './candidateList.controller.js';
import { authenticate, authorize } from '../../../middlewares/auth.middleware.js';
import { validate } from '../../../middlewares/validate.middleware.js';
import { ROLES } from '../../../constants/roles.js';
import {
  listCandidateListSchema,
  candidateListParamsSchema,
  createCandidateListSchema,
  updateCandidateListSchema,
} from './candidateList.schema.js';

const router = Router({ mergeParams: true });

const GESTORES = [ROLES.ADMIN];

router.get(
  '/',
  authenticate,
  validate(listCandidateListSchema),
  candidateListController.listCandidateLists
);

router.get(
  '/:id',
  authenticate,
  validate(candidateListParamsSchema),
  candidateListController.getCandidateListById
);

router.post(
  '/',
  authenticate,
  authorize(GESTORES),
  validate(createCandidateListSchema),
  candidateListController.createCandidateList
);

router.put(
  '/:id',
  authenticate,
  authorize(GESTORES),
  validate(updateCandidateListSchema),
  candidateListController.updateCandidateList
);

router.delete(
  '/:id',
  authenticate,
  authorize(GESTORES),
  validate(candidateListParamsSchema),
  candidateListController.deleteCandidateList
);

router.patch(
  '/:id',
  authenticate,
  authorize(GESTORES),
  validate(updateCandidateListSchema),
  candidateListController.updateCandidateList
);

export default router;
