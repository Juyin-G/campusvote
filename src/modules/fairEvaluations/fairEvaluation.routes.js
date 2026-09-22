// src/modules/fairEvaluations/fairEvaluation.routes.js
// Rutas de RÚBRICA CHECKLIST y hojas de respuesta (dominio FERIAS).
//
// ADMIN (gestión de rúbrica, sobre ferias de su organización):
//   POST   /api/fairs/:id/rubric
//   PUT    /api/fairs/:id/rubric
//   POST   /api/fairs/:id/rubric/criteria
//   PUT    /api/fairs/:id/rubric/criteria/:criterionId
//   DELETE /api/fairs/:id/rubric/criteria/:criterionId
//
// Lectura compartida (ADMIN con org dueña o JURY asignado):
//   GET    /api/fairs/:id/rubric
//
// Respuestas de rúbrica (JURY asignado):
//   GET    /api/fairs/:id/projects/:projectId/rubric       → mi hoja
//   PUT    /api/fairs/:id/projects/:projectId/rubric       → upsert + finalize?
//
// Proyectos evaluables + detalle:
//   GET    /api/fairs/:id/projects
//   GET    /api/fairs/:id/projects/:projectId
//
// Hojas de la feria (ADMIN todas / JURY las suyas):
//   GET    /api/fairs/:id/evaluations
//
// Declaración de jurado (JURY):
//   POST   /api/fairs/:id/jury/declaration
//   GET    /api/fairs/:id/jury/declaration
//
// Mi avance (JURY):
//   GET    /api/fairs/my-progress/:fairId
//   GET    /api/fairs/my-evaluations

import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { ROLES } from '../../constants/roles.js';
import * as fairEvalController from './fairEvaluation.controller.js';
import * as fairEvalSchema from './fairEvaluation.schema.js';

const router = Router();

const MANAGERS = [ROLES.ADMIN];
const READERS = [ROLES.ADMIN, ROLES.JURY];
const JURY = [ROLES.JURY];

// ── JURY: solo sus evaluaciones / progreso (path estático antes de /:id) ──
router.get(
  '/my-evaluations',
  authenticate,
  authorize(JURY),
  validate(fairEvalSchema.myEvaluationsSchema),
  fairEvalController.listMyEvaluations
);

router.get(
  '/my-progress/:fairId',
  authenticate,
  authorize(JURY),
  validate(fairEvalSchema.myProgressSchema),
  fairEvalController.getMyProgress
);

// ── Rúbrica (ADMIN) ──────────────────────────────────────────────
router.post(
  '/:id/rubric',
  authenticate,
  authorize(MANAGERS),
  validate(fairEvalSchema.createRubricSchema),
  fairEvalController.createRubric
);

router.get(
  '/:id/rubric',
  authenticate,
  authorize(READERS),
  validate(fairEvalSchema.getRubricSchema),
  fairEvalController.getRubric
);

router.put(
  '/:id/rubric',
  authenticate,
  authorize(MANAGERS),
  validate(fairEvalSchema.updateRubricSchema),
  fairEvalController.updateRubric
);

router.post(
  '/:id/rubric/criteria',
  authenticate,
  authorize(MANAGERS),
  validate(fairEvalSchema.addCriterionSchema),
  fairEvalController.addCriterion
);

router.put(
  '/:id/rubric/criteria/:criterionId',
  authenticate,
  authorize(MANAGERS),
  validate(fairEvalSchema.updateCriterionSchema),
  fairEvalController.updateCriterion
);

router.delete(
  '/:id/rubric/criteria/:criterionId',
  authenticate,
  authorize(MANAGERS),
  validate(fairEvalSchema.deleteCriterionSchema),
  fairEvalController.removeCriterion
);

// ── Proyectos evaluables ──────────────────────────────────────────
router.get(
  '/:id/projects',
  authenticate,
  authorize(READERS),
  validate(fairEvalSchema.listApprovedProjectsSchema),
  fairEvalController.listApprovedProjects
);

router.get(
  '/:id/projects/:projectId',
  authenticate,
  authorize(READERS),
  validate(fairEvalSchema.getProjectReviewSchema),
  fairEvalController.getProjectDetail
);

// ── Respuestas de rúbrica (JURY) ─────────────────────────────────
router.get(
  '/:id/projects/:projectId/rubric',
  authenticate,
  authorize(JURY),
  validate(fairEvalSchema.getMyChecklistSchema),
  fairEvalController.getMyChecklist
);

router.put(
  '/:id/projects/:projectId/rubric',
  authenticate,
  authorize(JURY),
  validate(fairEvalSchema.upsertChecklistSchema),
  fairEvalController.upsertChecklist
);

// ── Hojas de la feria ────────────────────────────────────────────
router.get(
  '/:id/evaluations',
  authenticate,
  authorize(READERS),
  validate(fairEvalSchema.listEvaluationsSchema),
  fairEvalController.listEvaluations
);

// ── Declaración de jurado (JURY) ─────────────────────────────────
router.get(
  '/:id/jury/declaration',
  authenticate,
  authorize(JURY),
  validate(fairEvalSchema.declarationGetSchema),
  fairEvalController.getMyDeclaration
);

router.post(
  '/:id/jury/declaration',
  authenticate,
  authorize(JURY),
  validate(fairEvalSchema.createDeclarationSchema),
  fairEvalController.createMyDeclaration
);

export default router;
