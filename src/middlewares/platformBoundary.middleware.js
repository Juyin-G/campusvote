// src/middlewares/platformBoundary.middleware.js
// CAMBIO: middleware nuevo. Bloquea al SUPERADMIN en TODAS las rutas de
// tenant. Se monta globalmente sobre el sub-router de Tenant Routes.

import { ApiError } from '../shared/errors/ApiError.js';
import { ROLES } from '../constants/roles.js';
import auditService from '../modules/audit/audit.service.js';
import logger from '../config/logger.js';

const PLATFORM_ACTIONS = new Set([
  'PROVISION_ADMIN',
  'CREATE_ORGANIZATION',
  'UPDATE_ORGANIZATION_PLATFORM',
  'DEACTIVATE_ORGANIZATION',
  'APPROVE_ORGANIZATION',
  'REJECT_ORGANIZATION',
  'ROTATE_SUPERADMIN',
  'GMAIL_TEST',
  'PLATFORM_CONFIG',
]);

/**
 * CAMBIO: guard de frontera. Si el actor es SUPERADMIN y la ruta es de
 * tenant, se rechaza con 403 inmediato y se registra en auditoría como
 * TENANT_ACCESS_VIOLATION (no ACCESS_DENIED, para distinguir del IDOR).
 */
export const blockSuperAdminFromTenantRoutes = async (req, res, next) => {
  if (!req.user) {
    return next(ApiError.unauthorized('No autenticado'));
  }

  if (req.user.role !== ROLES.SUPERADMIN) {
    return next();
  }

  try {
    await auditService.logAction({
      actorId: req.user.id ?? req.user.userId,
      action: 'TENANT_ACCESS_VIOLATION',
      ipAddress: req.ip ?? null,
      metadata: {
        path: req.originalUrl,
        method: req.method,
        actorRole: req.user.role,
        isSuperuser: req.user.isSuperuser ?? false,
        platformActionsAllowed: Array.from(PLATFORM_ACTIONS),
      },
    });
  } catch (err) {
    logger.warn('No se pudo registrar TENANT_ACCESS_VIOLATION', { error: err.message });
  }

  return next(
    ApiError.forbidden('El administrador de plataforma no tiene acceso a recursos de tenant')
  );
};

export default blockSuperAdminFromTenantRoutes;
