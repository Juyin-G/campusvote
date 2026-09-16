// src/modules/academic/voter-registry/voter-registry.routes.js
import { Router } from 'express';
import voterRegistryController from './voter-registry.controller.js';
import {
  voterRegistryIdParamSchema,
  syncSisVotersSchema,
  createVoterRegistrySchema,
  updateVoterRegistrySchema,
  getVoterRegistriesQuerySchema,
} from './voter-registry.schema.js';

// Asegúrate de ajustar la ruta real de tu validateMiddleware
import { validate } from '../../../middlewares/validate.middleware.js';
import { authenticate, authorize } from '../../../middlewares/auth.middleware.js';
import { ROLES } from '../../../constants/roles.js';

const router = Router();

// Solo gestores (ADMIN / COMISIÓN ELECTORAL) pueden gestionar el padrón.
const GESTORES = [ROLES.ADMIN];

// 1. Sincronización masiva desde SIS
// (El procedimiento almacenado sync_sis_voters exige rol ADMIN)
router.post(
  '/sync-sis',
  authenticate,
  authorize(ROLES.ADMIN),
  validate(syncSisVotersSchema),
  voterRegistryController.syncSisVoters
);

// 2. Obtener lista paginada y filtrada (el padrón es información sensible)
router.get(
  '/',
  authenticate,
  authorize(GESTORES),
  validate(getVoterRegistriesQuerySchema, 'query'),
  voterRegistryController.getVoters
);

// 3. Crear votante manualmente
router.post(
  '/',
  authenticate,
  authorize(GESTORES),
  validate(createVoterRegistrySchema),
  voterRegistryController.createVoter
);

// 4. Obtener votante por ID (datos personales)
router.get(
  '/:id',
  authenticate,
  authorize(GESTORES),
  validate(voterRegistryIdParamSchema, 'params'),
  voterRegistryController.getVoterById
);

// 5. Actualizar votante por ID
router.patch(
  '/:id',
  authenticate,
  authorize(GESTORES),
  validate(voterRegistryIdParamSchema, 'params'),
  validate(updateVoterRegistrySchema),
  voterRegistryController.updateVoter
);

// 6. Eliminar votante por ID
router.delete(
  '/:id',
  authenticate,
  authorize(GESTORES),
  validate(voterRegistryIdParamSchema, 'params'),
  voterRegistryController.deleteVoter
);

export default router;