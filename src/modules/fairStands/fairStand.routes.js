// src/modules/fairStands/fairStand.routes.js
// Rutas de STANDS/cabinas de ferias (dominio exclusivo de FERIAS).
//
// Lectura compartida (ADMIN/SUPERADMIN o JURY con asignación en la feria):
//   GET    /api/fairs/:id/stands
//
// Gestión (ADMIN/SUPERADMIN de la organización; SOLO en DRAFT):
//   POST   /api/fairs/:id/stands
//   PUT    /api/fairs/:id/stands/:standId
//   DELETE /api/fairs/:id/stands/:standId
//
// El scope por tenant, la configuración solo en DRAFT y la regla
// "1 stand = 1 proyecto" los resuelve el service (+ UNIQUE projects.stand_id).

import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { ROLES } from '../../constants/roles.js';
import * as standController from './fairStand.controller.js';
import * as standSchema from './fairStand.schema.js';

const router = Router();

const MANAGERS = [ROLES.ADMIN, ROLES.SUPERADMIN];
const READERS = [ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.JURY];

router.get(
  '/:id/stands',
  authenticate,
  authorize(READERS),
  validate(standSchema.listStandsSchema),
  standController.listStands
);

router.post(
  '/:id/stands',
  authenticate,
  authorize(MANAGERS),
  validate(standSchema.createStandSchema),
  standController.createStand
);

router.put(
  '/:id/stands/:standId',
  authenticate,
  authorize(MANAGERS),
  validate(standSchema.updateStandSchema),
  standController.updateStand
);

router.delete(
  '/:id/stands/:standId',
  authenticate,
  authorize(MANAGERS),
  validate(standSchema.deleteStandSchema),
  standController.deleteStand
);

export default router;