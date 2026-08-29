// src/modules/voting/voting.routes.js
// Rutas del módulo de VOTACIÓN.
//
// Flujo: el elector autenticado inicia una sesión de votación y luego
// emite su voto dentro de esa sesión. Participan los roles electorales
// (STUDENT, TEACHER, ADMIN, ELECTORAL_COMMISSION).

import { Router } from 'express';

import * as votingController from './voting.controller.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import {
  startSessionParamsSchema,
  castVoteParamsSchema,
  castVoteBodySchema,
  getSessionParamsSchema,
} from './voting.schema.js';

const router = Router();

/**
 * POST /api/voting/elections/:electionId/sessions
 * @desc Inicia una sesión de votación para el elector autenticado.
 * @access Autenticado (elector hábil)
 */
router.post(
  '/elections/:electionId/sessions',
  authenticate,
  validate(startSessionParamsSchema),
  votingController.startVotingSession
);

/**
 * POST /api/voting/sessions/:sessionId/cast
 * @desc Emite el voto dentro de una sesión iniciada.
 * @access Autenticado (dueño de la sesión)
 */
router.post(
  '/sessions/:sessionId/cast',
  authenticate,
  validate(castVoteParamsSchema),
  validate(castVoteBodySchema),
  votingController.castSecureVote
);

/**
 * GET /api/voting/sessions/:id
 * @desc Consulta el estado de una sesión de votación.
 * @access Autenticado (dueño de la sesión)
 */
router.get(
  '/sessions/:id',
  authenticate,
  validate(getSessionParamsSchema),
  votingController.getVotingSession
);

export default router;
