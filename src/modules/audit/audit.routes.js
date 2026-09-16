// src/modules/audit/audit.routes.js

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import asyncHandler from '../../shared/utils/asyncHandler.js';
import auditController from './audit.controller.js';
import { authenticate, authorize } from '../../middlewares/auth.middleware.js';
import { ApiError } from '../../shared/errors/ApiError.js';
import { ROLES } from '../../constants/roles.js';

const router = Router();

// CAMBIO: VIEWERS solo ADMIN del propio tenant pueden leer logs.
// Los logs de tenant son datos privados del cliente; SUPERADMIN no entra
// (regla de oro: tenants no se mezclan con plataforma).
const GESTORES = [ROLES.ADMIN];
const VIEWERS = [ROLES.ADMIN];

// Handler que delega en el error handler global para mantener el formato
// de respuesta 429 consistente con el resto de la API.
const tokenRateLimitHandler = (req, res, next, options) => {
  const retryAfterSeconds = Math.ceil((options?.windowMs || 0) / 1000);
  next(
    ApiError.tooManyRequests(
      'Demasiadas solicitudes desde esta IP. Intente más tarde.',
      { retryAfterSeconds, code: 'AUDIT_TOKEN_RATE_LIMITED' },
      'AUDIT_TOKEN_RATE_LIMITED'
    )
  );
};

// Limitador estricto para operaciones de tokens de votación/sensibles
const tokenRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 30, // 30 intentos por ventana
  standardHeaders: true,
  legacyHeaders: false,
  handler: tokenRateLimitHandler,
});

/**
 * RUTAS DE AUDIT LOGS (Trazabilidad e historial)
 */

router.get(
  '/verify',
  authenticate,
  authorize([ROLES.ADMIN]),
  asyncHandler(auditController.verifyAuditChain.bind(auditController))
);

router.get(
  '/logs',
  authenticate,
  authorize(VIEWERS),
  asyncHandler(auditController.getAuditLogs.bind(auditController))
);

router.get(
  '/logs/:id',
  authenticate,
  authorize(VIEWERS),
  asyncHandler(auditController.getAuditLogById.bind(auditController))
);

router.post(
  '/logs',
  authenticate,
  authorize(GESTORES),
  asyncHandler(auditController.createAuditLog.bind(auditController))
);

/**
 * RUTAS DE ONE-TIME TOKENS / VOTING TOKENS
 */

// Generar token para un usuario (Restringido a GESTORES para evitar acuñación no autorizada)
router.post(
  '/tokens',
  authenticate,
  authorize(GESTORES),
  asyncHandler(auditController.createOneTimeToken.bind(auditController))
);

// Consumir token en cabina/proceso de votación (protegido por Rate Limit)
router.post(
  '/tokens/consume',
  tokenRateLimiter,
  asyncHandler(auditController.consumeOneTimeToken.bind(auditController))
);

// Consultar validez de token sin consumirlo
router.get(
  '/tokens/status',
  tokenRateLimiter,
  asyncHandler(auditController.checkTokenStatus.bind(auditController))
);

// Mantenimiento y depuración de tokens vencidos (Solo administradores)
router.delete(
  '/tokens/cleanup',
  authenticate,
  authorize([ROLES.ADMIN]),
  asyncHandler(auditController.cleanupExpiredTokens.bind(auditController))
);

export default router;