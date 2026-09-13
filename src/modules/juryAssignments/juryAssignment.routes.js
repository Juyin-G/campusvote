// src/modules/juryAssignments/juryAssignment.routes.js
// Rutas de asignación de jurados a ferias (dominio de FERIAS).
//
// ADMIN / SUPERADMIN (gestión):
//   GET    /api/fairs/:id/juries            → jurados de una feria
//   POST   /api/fairs/:id/juries            → asignar usuario JURY
//   GET    /api/fairs/:id/juries/:userId    → consultar si un JURY está asignado
//   DELETE /api/fairs/:id/juries/:userId    → quitar un jurado
//
// JURY (solo consulta de sus propias asignaciones):
//   GET    /api/fairs/my-assignments        → ferias a las que está asignado
//   GET    /api/fairs/my-assignments/:fairId → detalle básico de una feria asignada
//
// Este router SE MONTA ANTES que fair.routes en /api/fairs para que el path
// estático /my-assignments gane sobre /:id.

import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { ROLES } from '../../constants/roles.js';
import * as juryController from './juryAssignment.controller.js';
import * as jurySchema from './juryAssignment.schema.js';

const router = Router();

const MANAGERS = [ROLES.ADMIN, ROLES.SUPERADMIN];

// ── ADMIN / SUPERADMIN ─────────────────────────────────────────────
router.get(
  '/:id/juries',
  authenticate,
  authorize(MANAGERS),
  validate(jurySchema.listJuriesSchema),
  juryController.listJuries
);

router.post(
  '/:id/juries',
  authenticate,
  authorize(MANAGERS),
  validate(jurySchema.assignJurySchema),
  juryController.assignJury
);

router.get(
  '/:id/juries/:userId',
  authenticate,
  authorize(MANAGERS),
  validate(jurySchema.juryOfFairSchema),
  juryController.getJuryAssignment
);

router.delete(
  '/:id/juries/:userId',
  authenticate,
  authorize(MANAGERS),
  validate(jurySchema.juryOfFairSchema),
  juryController.removeJury
);

// ── JURY: consulta de sus propias asignaciones ─────────────────────
router.get(
  '/my-assignments',
  authenticate,
  authorize([ROLES.JURY]),
  validate(jurySchema.listMyAssignmentsSchema),
  juryController.listMyAssignments
);

router.get(
  '/my-assignments/:fairId',
  authenticate,
  authorize([ROLES.JURY]),
  validate(jurySchema.myAssignmentDetailSchema),
  juryController.getMyAssignmentFair
);

export default router;