// src/modules/fairJuryCategoryAssignments/fairJuryCategoryAssignment.routes.js
// Rutas de asignación de JURADOS a CATEGORÍAS dentro de una FERIA.
//
// ADMIN (gestión, sobre ferias de su organización):
//   GET    /api/fairs/:id/juries/:userId/categories   → categorías asignadas
//   POST   /api/fairs/:id/juries/:userId/categories   → asignar categoría
//   DELETE /api/fairs/:id/juries/:userId/categories/:categoryId → quitar categoría
//
// SUPERADMIN NO tiene acceso operativo (403 desde este router).
// Solo en DRAFT: las asignaciones quedan congeladas al pasar a OPEN.

import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { ROLES } from '../../constants/roles.js';
import * as controller from './fairJuryCategoryAssignment.controller.js';
import * as schema from './fairJuryCategoryAssignment.schema.js';

const router = Router();

const MANAGERS = [ROLES.ADMIN];

router.get(
  '/:id/juries/:userId/categories',
  authenticate,
  authorize(MANAGERS),
  validate(schema.listJuryCategoryAssignmentsSchema),
  controller.listCategories
);

router.post(
  '/:id/juries/:userId/categories',
  authenticate,
  authorize(MANAGERS),
  validate(schema.assignJuryCategorySchema),
  controller.assignCategory
);

router.delete(
  '/:id/juries/:userId/categories/:categoryId',
  authenticate,
  authorize(MANAGERS),
  validate(schema.removeJuryCategorySchema),
  controller.removeCategory
);

export default router;
