// src/modules/elections/positions/position.routes.js
// S4-12 — Rutas de cargos, anidadas bajo /api/elections/:electionId/positions

import { Router } from 'express';
import * as positionController from './position.controller.js';
import { authenticate, authorize } from '../../../middlewares/auth.middleware.js';
import { validate } from '../../../middlewares/validate.middleware.js';
import { ROLES } from '../../../constants/roles.js';
import {
  listPositionSchema,
  positionParamsSchema,
  createPositionSchema,
  updatePositionSchema,
} from './position.schema.js';

const router = Router({ mergeParams: true });

const GESTORES = [ROLES.ADMIN];

router.get(
  '/',
  authenticate,
  validate(listPositionSchema),
  positionController.listPositions
);

router.get(
  '/:id',
  authenticate,
  validate(positionParamsSchema),
  positionController.getPositionById
);

router.post(
  '/',
  authenticate,
  authorize(GESTORES),
  validate(createPositionSchema),
  positionController.createPosition
);

// PATCH para actualización parcial, consistente con el schema de Zod
router.patch(
  '/:id',
  authenticate,
  authorize(GESTORES),
  validate(updatePositionSchema),
  positionController.updatePosition
);

router.delete(
  '/:id',
  authenticate,
  authorize(GESTORES),
  validate(positionParamsSchema),
  positionController.deletePosition
);

export default router;