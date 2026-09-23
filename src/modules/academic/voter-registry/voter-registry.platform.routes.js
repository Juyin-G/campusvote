import { Router } from 'express';
import { authenticate, authorizePlatform } from '../../../middlewares/auth.middleware.js';
import { ROLES } from '../../../constants/roles.js';
import voterRegistryController from './voter-registry.controller.js';

const router = Router();
const SUPERADMIN_ONLY = [ROLES.SUPERADMIN];

/**
 * RUTA DE PLATAFORMA: Sincronización masiva de padrón SIS.
 * Mitigación transitoria (Decisión P2): Restringido a SUPERADMIN hasta que
 * se aplique el fix SQL (014_fix_sis_sync.sql) que filtra por organization_id.
 */
router.post(
  '/sync-sis',
  authenticate,
  authorizePlatform(SUPERADMIN_ONLY),
  voterRegistryController.syncSisVoters
);

export default router;
