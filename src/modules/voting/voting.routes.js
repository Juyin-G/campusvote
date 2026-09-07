// src/modules/voting/voting.routes.js

import { Router } from 'express';

import * as votingController from './voting.controller.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { userLimiter } from '../../middlewares/rateLimiter.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import {
  startSessionSchema,
  castVoteParamsSchema,
  castVoteBodySchema,
  getSessionParamsSchema,
} from './voting.schema.js';

const router = Router();

/**
 * POST /api/voting/elections/:electionId/sessions
 * @desc Inicia una sesión de votación (y consume el token de 1 solo uso si aplica).
 * @access Autenticado (elector hábil)
 */
router.post(
  '/elections/:electionId/sessions',
  authenticate,
  userLimiter({ windowMs: 60 * 60 * 1000, max: 30 }),
  validate(startSessionSchema),
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
  userLimiter({ windowMs: 60 * 60 * 1000, max: 10 }),
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