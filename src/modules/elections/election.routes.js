// src/modules/elections/election.routes.js
// S4-12 — Router principal del módulo de elecciones.
//
// Monta los sub-recursos anidados y luego el CRUD de la propia elección.
// El orden importa: los sub-routers van primero para que rutas como
// /:electionId/positions no las capture accidentalmente /:id.

import { Router } from 'express';
import * as electionController from './election.controller.js';
import positionRoutes from './position.routes.js';
import candidateListRoutes from './candidateList.routes.js';
import candidacyRoutes from './candidacy.routes.js';
import electionRulesRoutes from './electionRules.routes.js';
import { authenticate, authorize } from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { ROLES } from '../../constants/roles.js';
import {
  listElectionSchema,
  electionParamsSchema,
  createElectionSchema,
  updateElectionSchema,
  changeStatusSchema,
} from './election.schema.js';

const router = Router();

const GESTORES = [ROLES.ADMIN, ROLES.ELECTORAL_COMMISSION];

// ── Sub-recursos anidados ─────────────────────────────
router.use('/:electionId/positions', positionRoutes);
router.use('/:electionId/candidate-lists', candidateListRoutes);
router.use('/:electionId/candidacies', candidacyRoutes);
router.use('/:electionId/rules', electionRulesRoutes);

// ── CRUD de elecciones ────────────────────────────────
router.get(
  '/',
  authenticate,
  validate(listElectionSchema),
  electionController.listElections
);

router.get(
  '/:id',
  authenticate,
  validate(electionParamsSchema),
  electionController.getElectionById
);

router.post(
  '/',
  authenticate,
  authorize(GESTORES),
  validate(createElectionSchema),
  electionController.createElection
);

router.put(
  '/:id',
  authenticate,
  authorize(GESTORES),
  validate(updateElectionSchema),
  electionController.updateElection
);

// Borrar una elección es irreversible: se reserva a ADMIN.
router.delete(
  '/:id',
  authenticate,
  authorize(ROLES.ADMIN),
  validate(electionParamsSchema),
  electionController.deleteElection
);

// ── S4-13: workflow de estados ────────────────────────
router.patch(
  '/:id/status',
  authenticate,
  authorize(GESTORES),
  validate(changeStatusSchema),
  electionController.changeStatus
);

export default router;
