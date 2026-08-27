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

const router = Router();

// 1. Sincronización masiva desde SIS
router.post(
  '/sync-sis',
  validate(syncSisVotersSchema),
  voterRegistryController.syncSisVoters
);

// 2. Obtener lista paginada y filtrada
router.get(
  '/',
  validate(getVoterRegistriesQuerySchema, 'query'),
  voterRegistryController.getVoters
);

// 3. Crear votante manualmente
router.post(
  '/',
  validate(createVoterRegistrySchema),
  voterRegistryController.createVoter
);

// 4. Obtener votante por ID
router.get(
  '/:id',
  validate(voterRegistryIdParamSchema, 'params'),
  voterRegistryController.getVoterById
);

// 5. Actualizar votante por ID
router.patch(
  '/:id',
  validate(voterRegistryIdParamSchema, 'params'),
  validate(updateVoterRegistrySchema),
  voterRegistryController.updateVoter
);

// 6. Eliminar votante por ID
router.delete(
  '/:id',
  validate(voterRegistryIdParamSchema, 'params'),
  voterRegistryController.deleteVoter
);

export default router;