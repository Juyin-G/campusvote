// src/modules/ballots/ballotPositions/ballotPosition.routes.js
// S5-07 — Rutas de posiciones dentro de una boleta.

import { Router } from 'express';

import * as ballotPositionController from './ballotPosition.controller.js';
import ballotOptionRoutes from '../ballotOptions/ballotOption.routes.js';

import { authenticate, authorize } from '../../../middlewares/auth.middleware.js';
import { validate } from '../../../middlewares/validate.middleware.js';
import { ROLES } from '../../../constants/roles.js';

import {
  listBallotPositionSchema,
  ballotPositionParamsSchema,
  createBallotPositionSchema,
  updateBallotPositionSchema,
} from './ballotPosition.schema.js';

/**
 * Se activa mergeParams: true para heredar el parámetro :ballotId 
 * definido en la ruta padre (ballot.routes.js).
 */
const router = Router({
  mergeParams: true,
});

const GESTORES = [
  ROLES.ADMIN,
  ROLES.ELECTORAL_COMMISSION,
];

// ==========================================
// Subrecurso de Opciones de Boleta
// /api/ballots/:ballotId/positions/:ballotPositionId/options
// ==========================================
router.use(
  '/:ballotPositionId/options',
  ballotOptionRoutes
);

// ==========================================
// Endpoints de Posiciones de Boleta
// ==========================================

/**
 * @route GET /api/ballots/:ballotId/positions
 * @desc Listar todas las posiciones asociadas a una boleta
 * @access Autenticado
 */
router.get(
  '/',
  authenticate,
  validate(listBallotPositionSchema),
  ballotPositionController.listBallotPositions
);

/**
 * @route GET /api/ballots/:ballotId/positions/:id
 * @desc Obtener el detalle de una posición específica dentro de la boleta
 * @access Autenticado
 */
router.get(
  '/:id',
  authenticate,
  validate(ballotPositionParamsSchema),
  ballotPositionController.getBallotPositionById
);

/**
 * @route POST /api/ballots/:ballotId/positions
 * @desc Agregar una nueva posición (cargo) a la boleta
 * @access ADMIN, ELECTORAL_COMMISSION
 */
router.post(
  '/',
  authenticate,
  authorize(GESTORES),
  validate(createBallotPositionSchema),
  ballotPositionController.createBallotPosition
);

/**
 * @route PUT /api/ballots/:ballotId/positions/:id
 * @desc Actualizar una posición (cargo / orden) dentro de la boleta
 * @access ADMIN, ELECTORAL_COMMISSION
 */
router.put(
  '/:id',
  authenticate,
  authorize(GESTORES),
  validate(updateBallotPositionSchema),
  ballotPositionController.updateBallotPosition
);

/**
 * @route DELETE /api/ballots/:ballotId/positions/:id
 * @desc Remover una posición de la boleta
 * @access ADMIN, ELECTORAL_COMMISSION
 */
router.delete(
  '/:id',
  authenticate,
  authorize(GESTORES),
  validate(ballotPositionParamsSchema),
  ballotPositionController.deleteBallotPosition
);

export default router;