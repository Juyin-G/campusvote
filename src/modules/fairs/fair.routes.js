// src/modules/fairs/fair.routes.js
// Rutas de ferias/eventos académicos.
// Gestión exclusiva de ADMIN / SUPERADMIN:
//   - ADMIN gestiona las ferias de SU organización (scope por tenant en service).
//   - ELECTORAL_COMMISSION, JURY, STUDENT y TEACHER NO gestionan ferias
//     (sin permisos nuevos en este paso).

import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { ROLES } from '../../constants/roles.js';
import * as fairController from './fair.controller.js';
import * as fairSchema from './fair.schema.js';

const router = Router();

const MANAGERS = [ROLES.ADMIN, ROLES.SUPERADMIN];

router.use(authenticate, authorize(MANAGERS));

router.get('/', validate(fairSchema.listFairsQuerySchema), fairController.listFairs);

router.post('/', validate(fairSchema.createFairSchema), fairController.createFair);

router.get('/:id', validate(fairSchema.idParamSchema), fairController.getFairById);

router.put('/:id', validate(fairSchema.updateFairSchema), fairController.updateFair);

router.post(
  '/:id/status',
  validate(fairSchema.changeStatusSchema),
  fairController.changeFairStatus
);

export default router;