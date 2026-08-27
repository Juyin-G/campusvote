// src/modules/elections/electionRules/electionRules.routes.js
// S4-12 — Rutas de reglas de elección, anidadas bajo
//         /api/elections/:electionId/rules
//
// Recurso singular (relación 1:1): no lleva :id propio.

import { Router } from 'express';
import * as electionRulesController from './electionRules.controller.js';
import { authenticate, authorize } from '../../../middlewares/auth.middleware.js';
import { validate } from '../../../middlewares/validate.middleware.js';
import { ROLES } from '../../../constants/roles.js';
import {
  electionRulesParamsSchema,
  createElectionRulesSchema,
  updateElectionRulesSchema,
} from './electionRules.schema.js';

const router = Router({ mergeParams: true });

const GESTORES = [ROLES.ADMIN, ROLES.ELECTORAL_COMMISSION];

// Obtener reglas existentes
router.get(
  '/',
  authenticate,
  validate(electionRulesParamsSchema),
  electionRulesController.getRules
);

// Crear reglas por primera vez
router.post(
  '/',
  authenticate,
  authorize(GESTORES),
  validate(createElectionRulesSchema),
  electionRulesController.createRules
);

// Actualizar parcialmente (PATCH es el estándar para updates parciales)
router.patch(
  '/',
  authenticate,
  authorize(GESTORES),
  validate(updateElectionRulesSchema),
  electionRulesController.updateRules
);

// Eliminar reglas (vuelven a los valores por defecto de la BD)
router.delete(
  '/',
  authenticate,
  authorize(GESTORES),
  validate(electionRulesParamsSchema),
  electionRulesController.deleteRules
);

export default router;