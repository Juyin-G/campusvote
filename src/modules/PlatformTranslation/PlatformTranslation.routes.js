// src/modules/PlatformTranslation/PlatformTranslation.routes.js

import { Router } from 'express';
import * as translationController from './PlatformTranslation.controller.js';
import { authenticate, authorize } from '../../middlewares/auth.middleware.js'; 
import { validate } from '../../middlewares/validate.middleware.js';
import { ROLES } from '../../constants/roles.js';
import {
  createPlatformTranslationSchema,
  updatePlatformTranslationSchema,
  getDictionarySchema,
  getEffectiveLocaleSchema,
} from './PlatformTranslation.schema.js';

const router = Router();

// Solo administradores pueden modificar el diccionario
const ADMIN_ONLY = [ROLES.ADMIN]; 

// ── Rutas de Utilidad / Lectura 
router.get(
  '/dictionary',
  // authenticate, // Descomenta si requieres token
  validate(getDictionarySchema),
  translationController.getDictionary
);

router.get(
  '/effective-locale/:userId',
  authenticate,
  authorize(ADMIN_ONLY),
  validate(getEffectiveLocaleSchema),
  translationController.getEffectiveLocale
);

// ── CRUD de Administración del Diccionario ──────────────────
router.get(
  '/',
  authenticate,
  authorize(ADMIN_ONLY),
  translationController.listTranslations
);

router.get(
  '/:id',
  authenticate,
  authorize(ADMIN_ONLY),
  translationController.getTranslationById
);

router.post(
  '/',
  authenticate,
  authorize(ADMIN_ONLY),
  validate(createPlatformTranslationSchema),
  translationController.createTranslation
);

router.patch(
  '/:id',
  authenticate,
  authorize(ADMIN_ONLY),
  validate(updatePlatformTranslationSchema),
  translationController.updateTranslation
);

router.delete(
  '/:id',
  authenticate,
  authorize(ADMIN_ONLY),
  translationController.deleteTranslation
);

export default router;