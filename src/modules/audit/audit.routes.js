import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import auditController from './audit.controller.js';
import { authenticate, authorize } from '../../middlewares/auth.middleware.js';

const router = Router();

// Limitador estricto para operaciones de tokens de votación/sensibles
const tokenRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 30, // 30 intentos por ventana
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { message: 'Demasiadas solicitudes desde esta IP. Intente más tarde.' }
  }
});

// Middleware para envolver handlers asíncronos sin repetir try/catch
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * RUTAS DE AUDIT LOGS (Trazabilidad e historial)
 */

router.get(
  '/logs',
  authenticate,
  authorize(['SUPER_ADMIN', 'ADMIN', 'AUDITOR']),
  asyncHandler(auditController.getAuditLogs.bind(auditController))
);

router.get(
  '/logs/:id',
  authenticate,
  authorize(['SUPER_ADMIN', 'ADMIN', 'AUDITOR']),
  asyncHandler(auditController.getAuditLogById.bind(auditController))
);

router.post(
  '/logs',
  authenticate,
  authorize(['SUPER_ADMIN', 'ADMIN', 'SYSTEM']),
  asyncHandler(auditController.createAuditLog.bind(auditController))
);

/**
 * RUTAS DE ONE-TIME TOKENS / VOTING TOKENS
 */

// Generar token para un usuario (requiere sesión autenticada)
router.post(
  '/tokens',
  authenticate,
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
  authorize(['SUPER_ADMIN', 'ADMIN']),
  asyncHandler(auditController.cleanupExpiredTokens.bind(auditController))
);

export default router;