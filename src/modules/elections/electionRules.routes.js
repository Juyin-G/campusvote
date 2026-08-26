// src/modules/elections/electionRules.routes.js
// S4-12 — Rutas de reglas de elección, anidadas bajo
//         /api/elections/:electionId/rules
//
// Recurso singular (relación 1:1): no lleva :id propio.

import { Router } from 'express';
import * as electionRulesController from './electionRules.controller.js';
import { authenticate, authorize } from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { ROLES } from '../../constants/roles.js';
import {
  electionRulesParamsSchema,
  createElectionRulesSchema,
  updateElectionRulesSchema,
} from './electionRules.schema.js';

const router = Router({ mergeParams: true });

const GESTORES = [ROLES.ADMIN, ROLES.ELECTORAL_COMMISSION];

router.get(
  '/',
  authenticate,
  validate(electionRulesParamsSchema),
  electionRulesController.getRules
);

router.post(
  '/',
  authenticate,
  authorize(GESTORES),
  validate(createElectionRulesSchema),
  electionRulesController.createRules
);

router.put(
  '/',
  authenticate,
  authorize(GESTORES),
  validate(updateElectionRulesSchema),
  electionRulesController.updateRules
);

router.delete(
  '/',
  authenticate,
  authorize(GESTORES),
  validate(electionRulesParamsSchema),
  electionRulesController.deleteRules
);

export default router;
