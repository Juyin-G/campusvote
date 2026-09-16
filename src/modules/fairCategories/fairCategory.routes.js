// src/modules/fairCategories/fairCategory.routes.js
// Rutas de CATEGORÍAS de ferias (dominio exclusivo de FERIAS).
//
// Lectura compartida (ADMIN con org dueña o JURY asignado):
//   GET    /api/fairs/:id/categories
//
// Gestión (ADMIN de la organización; SOLO en DRAFT):
//   POST   /api/fairs/:id/categories
//   PUT    /api/fairs/:id/categories/:categoryId
//   DELETE /api/fairs/:id/categories/:categoryId
//
// El scope por tenant y la configuración solo en DRAFT los resuelve el service.
// SUPERADMIN NO tiene acceso operativo (403 desde este router; sin bypass
// aunque tenga organizationId).

import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { ROLES } from '../../constants/roles.js';
import * as categoryController from './fairCategory.controller.js';
import * as categorySchema from './fairCategory.schema.js';

const router = Router();

const MANAGERS = [ROLES.ADMIN];
const READERS = [ROLES.ADMIN, ROLES.JURY];

router.get(
  '/:id/categories',
  authenticate,
  authorize(READERS),
  validate(categorySchema.listCategoriesSchema),
  categoryController.listCategories
);

router.post(
  '/:id/categories',
  authenticate,
  authorize(MANAGERS),
  validate(categorySchema.createCategorySchema),
  categoryController.createCategory
);

router.put(
  '/:id/categories/:categoryId',
  authenticate,
  authorize(MANAGERS),
  validate(categorySchema.updateCategorySchema),
  categoryController.updateCategory
);

router.delete(
  '/:id/categories/:categoryId',
  authenticate,
  authorize(MANAGERS),
  validate(categorySchema.deleteCategorySchema),
  categoryController.deleteCategory
);

export default router;