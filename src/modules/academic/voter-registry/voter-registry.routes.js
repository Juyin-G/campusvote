import { Router } from 'express';
import { authenticate, authorizePlatform } from '../../../middlewares/auth.middleware.js';
import { ROLES } from '../../../constants/roles.js';
import voterRegistryController from './voter-registry.controller.js';

const router = Router();
const SUPERADMIN_ONLY = [ROLES.SUPERADMIN];

/**
 * RUTA DE PLATAFORMA: Sincronización masiva de padrón SIS.
 * Mitigación transitoria: Restringido a SUPERADMIN hasta el fix SQL.
 */
router.post(
  '/sync-sis',
  authenticate,
  authorizePlatform(SUPERADMIN_ONLY),
  voterRegistryController.syncSisVoters
);

export default router;
