// src/modules/fairVoting/fairVoting.routes.js
// Rutas de VOTACIÓN ANÓNIMA de JURADO en FERIAS.
//
// JURY (solo JURY asignado a la feria):
//   POST /api/fairs/:fairId/votes                → emitir voto
//   GET  /api/fairs/:fairId/voting/status        → hasVoted + votedAt (sin proyecto)
//
// ADMIN (de la organización dueña de la feria):
//   GET  /api/fairs/:fairId/voting/results       → conteos por proyecto
//
// Público (verificación de comprobante):
//   GET  /api/fairs/:fairId/voting/verify/:receiptCode

import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { ROLES } from '../../constants/roles.js';
import * as fairVotingController from './fairVoting.controller.js';
import * as fairVotingSchema from './fairVoting.schema.js';

const router = Router();

const MANAGERS = [ROLES.ADMIN];
const JURY = [ROLES.JURY];

// POST /api/fairs/:fairId/votes
router.post(
  '/:fairId/votes',
  authenticate,
  authorize(JURY),
  validate(fairVotingSchema.castVoteSchema),
  fairVotingController.castVote
);

// GET /api/fairs/:fairId/voting/status
router.get(
  '/:fairId/voting/status',
  authenticate,
  authorize(JURY),
  validate(fairVotingSchema.votingStatusSchema),
  fairVotingController.getVotingStatus
);

// GET /api/fairs/:fairId/voting/results (ADMIN)
router.get(
  '/:fairId/voting/results',
  authenticate,
  authorize(MANAGERS),
  validate(fairVotingSchema.votingResultsSchema),
  fairVotingController.getVotingResults
);

// GET /api/fairs/:fairId/voting/verify/:receiptCode (público)
router.get(
  '/:fairId/voting/verify/:receiptCode',
  validate(fairVotingSchema.verifyReceiptSchema),
  fairVotingController.verifyReceipt
);

export default router;
