// src/modules/fairResults/fairResult.routes.js
// Rutas de RESULTADOS de proyectos de FERIAS (dominio exclusivo de ferias).
//
//   GET  /api/fairs/:id/results         → ranking de la feria (ADMIN/SUPERADMIN)
//   POST /api/fairs/:id/results/publish → publicación oficial (ADMIN/SUPERADMIN)
//
// Autorización:
//   - ADMIN opera SOLO sobre ferias de su organización (tenant en service).
//   - SUPERADMIN mantiene el bypass de tenant ya existente.
//   - JURY NO obtiene acceso global a resultados por ser jurado.
//   - STUDENT/TEACHER/ELECTORAL_COMMISSION sin acceso administrativo.
//
// El ranking, el promedio y el ganador se derivan del backend (evaluaciones en
// BD); al publicar solo se persiste el evento (fair + published_by + fecha).
// Este router se monta ANTES que fairRoutes para que /:id/results y
// /:id/results/publish no colisionen con /:id.

import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { ROLES } from '../../constants/roles.js';
import * as fairResultController from './fairResult.controller.js';
import * as fairResultSchema from './fairResult.schema.js';

const router = Router();

const MANAGERS = [ROLES.ADMIN, ROLES.SUPERADMIN];

router.get(
  '/:id/results',
  authenticate,
  authorize(MANAGERS),
  validate(fairResultSchema.getFairResultsSchema),
  fairResultController.getFairResults
);

router.post(
  '/:id/results/publish',
  authenticate,
  authorize(MANAGERS),
  validate(fairResultSchema.publishFairResultsSchema),
  fairResultController.publishFairResults
);

export default router;