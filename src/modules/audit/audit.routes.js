// src/modules/audit/audit.routes.js

import { Router } from 'express';
import asyncHandler from '../../shared/utils/asyncHandler.js';
import auditController from './audit.controller.js';
import { authenticate, authorize } from '../../middlewares/auth.middleware.js';
import { ROLES } from '../../constants/roles.js';

const router = Router();

// CAMBIO: VIEWERS solo ADMIN del propio tenant pueden leer logs.
// Los logs de tenant son datos privados del cliente; SUPERADMIN no entra
// (regla de oro: tenants no se mezclan con plataforma).
const GESTORES = [ROLES.ADMIN];
const VIEWERS = [ROLES.ADMIN];

/**
 * RUTAS DE AUDIT LOGS (Trazabilidad e historial)
 */

router.get(
  '/verify',
  authenticate,
  authorize(GESTORES),
  asyncHandler(auditController.verifyAuditChain)
);

router.get(
  '/logs',
  authenticate,
  authorize(VIEWERS),
  asyncHandler(auditController.getAuditLogs)
);

router.get(
  '/logs/:id',
  authenticate,
  authorize(VIEWERS),
  asyncHandler(auditController.getAuditLogById)
);

router.post(
  '/logs',
  authenticate,
  authorize(GESTORES),
  asyncHandler(auditController.createAuditLog)
);

export default router;