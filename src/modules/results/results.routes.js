// src/modules/results/results.routes.js
// S7-11 — Router principal del módulo de Resultados con protección IDOR Multi-tenant.

import { Router } from 'express';
import * as resultsController from './results.controller.js';
import * as certificationController from './certification/certification.controller.js';
import * as publicationController from './publication/publication.controller.js';
import * as tallyController from './tally/tally.controller.js';
import * as peruController from './peru/peru.controller.js';
import reportRoutes from './report/report.routes.js';
import exportRoutes from './export/export.routes.js';
import asyncHandler from '../../shared/utils/asyncHandler.js';
import { authenticate, authorize } from '../../middlewares/auth.middleware.js';
import { requireElectionInScope } from '../../middlewares/scope.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { ROLES } from '../../constants/roles.js';
import {
  electionIdParamSchema,
  liveResultsQuerySchema,
  finalResultsQuerySchema,
  certifyWeightedSchema,
  finalizeFairSchema,
} from './results.schema.js';

const router = Router();

const GESTORES = [ROLES.ADMIN, ROLES.ELECTORAL_COMMISSION];

// CERTIFY / PUBLISH (S7-03 / S7-04)


// POST /api/elections/:id/certify
router.post(
  '/elections/:id/certify',
  authenticate,
  authorize(GESTORES),
  validate(electionIdParamSchema),
  asyncHandler(requireElectionInScope),
  asyncHandler(certificationController.certifyElection)
);

// POST /api/elections/:id/publish
router.post(
  '/elections/:id/publish',
  authenticate,
  authorize(GESTORES),
  validate(electionIdParamSchema),
  asyncHandler(requireElectionInScope),
  asyncHandler(publicationController.publishElection)
);

// TALLY (S7-01)

// POST /api/elections/:id/tally/recalculate
router.post(
  '/elections/:id/tally/recalculate',
  authenticate,
  authorize(GESTORES),
  validate(electionIdParamSchema),
  asyncHandler(requireElectionInScope),
  asyncHandler(tallyController.recalculateTallies)
);

// Adaptación peruana (F2/F6/F7)

// POST /api/elections/:id/certify-weighted — voto ponderado por estamento
router.post(
  '/elections/:id/certify-weighted',
  authenticate,
  authorize(GESTORES),
  validate(certifyWeightedSchema),
  asyncHandler(requireElectionInScope),
  asyncHandler(peruController.certifyWeighted)
);

// POST /api/elections/:id/finalize-fair — ranking final de feria (80/20)
router.post(
  '/elections/:id/finalize-fair',
  authenticate,
  authorize(GESTORES),
  validate(finalizeFairSchema),
  asyncHandler(requireElectionInScope),
  asyncHandler(peruController.finalizeFair)
);

// GET /api/elections/:id/tally
router.get(
  '/elections/:id/tally',
  authenticate,
  authorize(GESTORES),
  validate(electionIdParamSchema),
  asyncHandler(requireElectionInScope),
  asyncHandler(tallyController.getTallies)
);

// LIVE / FINAL (S7-05) — acceso autenticado y validado por tenant

// GET /api/results/live?election_id=...
router.get(
  '/results/live',
  authenticate,
  validate(liveResultsQuerySchema),
  asyncHandler(requireElectionInScope),
  asyncHandler(resultsController.getLiveResults)
);

// GET /api/results/final?election_id=...
router.get(
  '/results/final',
  authenticate,
  validate(finalResultsQuerySchema),
  asyncHandler(requireElectionInScope),
  asyncHandler(resultsController.getFinalResults)
);

// REPORT PDF (S7-09) + EXPORT CSV/XLSX (S7-10)


router.use(reportRoutes);
router.use(exportRoutes);

export default router;