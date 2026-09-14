// src/modules/ballots/ballot.routes.js

import { Router } from 'express';

import * as ballotController from './ballot.controller.js';
import ballotPositionRoutes from './ballotPositions/ballotPosition.routes.js';

import {
  authenticate,
  authorize,
} from '../../middlewares/auth.middleware.js';

import { validate } from '../../middlewares/validate.middleware.js';
import { ROLES } from '../../constants/roles.js';
import {
  requireBallotInScope,
  requireElectionInScope,
} from '../../middlewares/scope.middleware.js';

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

// Funciones Especiales y Diagnóstico

/**
 * @route GET /api/ballots/election/:electionId/active
 * @desc Obtener la boleta activa de una elección
 * @access Autenticado
 */
router.get(
  '/election/:electionId/active',
  authenticate,
  validate(electionBallotParamsSchema),
  requireElectionInScope,
  ballotController.getActiveBallot
);

/**
 * @route POST /api/ballots/election/:electionId/version
 * @desc Crear una nueva versión de boleta para una elección
 * @access ADMIN, ELECTORAL_COMMISSION
 */
router.post(
  '/election/:electionId/version',
  authenticate,
  authorize(GESTORES),
  validate(electionBallotParamsSchema),
  requireElectionInScope,
  ballotController.createBallotVersion
);

/**
 * @route GET /api/ballots/:id/completeness
 * @desc Validar si la boleta está completa para publicación/votación
 * @access Autenticado
 */
router.get(
  '/:id/completeness',
  authenticate,
  validate(validateCompletenessSchema),
  ballotController.validateBallotCompleteness
);

// Subrecurso Anidado: Posiciones

router.use(
  '/:ballotId/positions',
  authenticate,
  requireBallotInScope,
  ballotPositionRoutes
);

// CRUD Base de Boletas


/**
 * @route GET /api/ballots
 * @desc Listar boletas con paginación y filtros
 * @access Autenticado
 */
router.get(
  '/',
  authenticate,
  validate(listBallotSchema),
  requireElectionInScope,
  ballotController.listBallots
);

/**
 * @route GET /api/ballots/:id
 * @desc Obtener detalle de una boleta por ID
 * @access Autenticado
 */
router.get(
  '/:id',
  authenticate,
  validate(ballotParamsSchema),
  ballotController.getBallotById
);

/**
 * @route POST /api/ballots
 * @desc Crear una nueva boleta
 * @access ADMIN, ELECTORAL_COMMISSION
 */
router.post(
  '/',
  authenticate,
  authorize(GESTORES),
  validate(createBallotSchema),
  requireElectionInScope,
  ballotController.createBallot
);

/**
 * @route PUT /api/ballots/:id
 * @desc Actualizar metadatos o estado de una boleta
 * @access ADMIN, ELECTORAL_COMMISSION
 */
router.put(
  '/:id',
  authenticate,
  authorize(GESTORES),
  validate(updateBallotSchema),
  ballotController.updateBallot
);

/**
 * @route DELETE /api/ballots/:id
 * @desc Eliminar una boleta
 * @access ADMIN, ELECTORAL_COMMISSION
 */
router.delete(
  '/:id',
  authenticate,
  authorize(GESTORES),
  validate(ballotParamsSchema),
  ballotController.deleteBallot
);

export default router;