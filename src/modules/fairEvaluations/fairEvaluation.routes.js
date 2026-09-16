// src/modules/fairEvaluations/fairEvaluation.routes.js
// Rúbricas y evaluaciones de proyectos de FERIAS (dominio exclusivo de ferias).
//
// Rúbrica (ADMIN de la organización; configuración SOLO en DRAFT):
//   POST   /api/fairs/:id/rubric                    → crear rúbrica
//   PUT    /api/fairs/:id/rubric                    → actualizar rúbrica
//   POST   /api/fairs/:id/rubric/criteria           → agregar criterio
//   PUT    /api/fairs/:id/rubric/criteria/:criterionId → actualizar criterio
//   DELETE /api/fairs/:id/rubric/criteria/:criterionId → eliminar criterio
//
// Consulta compartida (ADMIN con org dueña o JURY asignado):
//   GET    /api/fairs/:id/rubric                    → rúbrica (planificada por la feria)
//   GET    /api/fairs/:id/projects                  → proyectos APPROVED evaluables
//   GET    /api/fairs/:id/evaluations               → ADMIN: todas; JURY: solo las suyas
//
// Revisión/detalle de proyectos (JURY asignado para revisar; ADMIN con org
// dueña para consultar la información de un proyecto desde resultados; sin
// ProjectReview ni ProjectDetail):
//   GET    /api/fairs/:id/projects/:projectId       → detalle existente del
//          proyecto (nombre, descripción, logo_url, cover_url, project_url,
//          integrantes, categoría y stand). JURY no asignado → 403; proyecto
//          de otra feria o no APPROVED → 404.
//
// Declaración de jurado (JURY; mientras la feria NO esté CLOSED):
//   POST   /api/fairs/:id/jury/declaration          → firmar declaración
//   GET    /api/fairs/:id/jury/declaration          → consultar declaración
//
// Mi avance (JURY):
//   GET    /api/fairs/my-progress/:fairId           → avance del jurado
//
// Evaluaciones (JURY):
//   POST   /api/fairs/:id/evaluations               → registrar evaluación
//          (EXIGE la declaración de jurado firmada previamente)
//   PUT    /api/fairs/:id/evaluations/:evaluationId → actualizar SU propia evaluación
//   GET    /api/fairs/my-evaluations                → evaluaciones del JURY autenticado
//
// NO se implementan borrados de evaluaciones en este paso (queda documentado
// para una fase futura de administración de resultados).
//
// Reglas de dominio (validadas en service + reforzadas en los SQL):
//   - La rúbrica es UNA por feria y solo se configura en DRAFT; se congela al
//     abrir la feria (OPEN) y queda en lectura al cerrarla (CLOSED).
//   - Las evaluaciones solo en feria OPEN, sobre proyectos APPROVED de la MISMA
//     feria, por jurados formalmente asignados (fair_jury_assignments).
//   - UNA evaluación por (feria, proyecto, jurado); el jurado actualiza la suya.
//   - El backend resuelve la rúbrica vía FAIR; el cliente nunca envía rúbricas
//     o criterios arbitrarios, y cada score se valida contra el rango del criterio.
//
// Autorización:
//   - SUPERADMIN NO tiene acceso operativo a rúbricas/evaluaciones administrativas
//     (403 desde este router; sin bypass aunque tenga organizationId). Solo ADMIN
//     de la organización dueña de la feria accede a la gestión/consulta admin.

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

// ── JURY: solo sus propias evaluaciones (path estático ANTES de /:id) ──
router.get(
  '/my-evaluations',
  authenticate,
  authorize(JURY),
  validate(fairEvalSchema.myEvaluationsSchema),
  fairEvalController.listMyEvaluations
);

// ── Mi avance (JURY; path estático ANTES de /:id) ─────────────────────
router.get(
  '/my-progress/:fairId',
  authenticate,
  authorize(JURY),
  validate(fairEvalSchema.myProgressSchema),
  fairEvalController.getMyProgress
);

// ── Rúbrica (ADMIN: gestión; lectura también JURY asignado) ──
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

// ── Proyectos evaluables (consulta ADMIN o JURY asignado) ──
router.get(
  '/:id/projects',
  authenticate,
  authorize(READERS),
  validate(fairEvalSchema.listApprovedProjectsSchema),
  fairEvalController.listApprovedProjects
);

// ── Detalle de proyecto (consulta compartida JURY asignado + ADMIN) ──
// /:id/projects/:projectId no colisiona con /:id/projects (paths exactos).
// El JURY revisa la información existente del proyecto ANTES de evaluar; el
// ADMIN de la organización dueña consume el mismo detalle desde la vista
// de resultados. Sin ProjectReview ni ProjectDetail: se deriva de Project +
// ProjectMember.
router.get(
  '/:id/projects/:projectId',
  authenticate,
  authorize(READERS),
  validate(fairEvalSchema.getProjectReviewSchema),
  fairEvalController.getProjectDetail
);

// ── Declaración de jurado (JURY) ─────────────────────────────────────
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

// ── Evaluaciones ────────────────────────────────────────────────────
router.get(
  '/:id/evaluations',
  authenticate,
  authorize(READERS),
  validate(fairEvalSchema.listEvaluationsSchema),
  fairEvalController.listEvaluations
);

router.post(
  '/:id/evaluations',
  authenticate,
  authorize(JURY),
  validate(fairEvalSchema.createEvaluationSchema),
  fairEvalController.createEvaluation
);

router.put(
  '/:id/evaluations/:evaluationId',
  authenticate,
  authorize(JURY),
  validate(fairEvalSchema.updateEvaluationSchema),
  fairEvalController.updateEvaluation
);

export default router;