import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import auditController from './audit.controller.js';
import { authenticate, authorize } from '../../middlewares/auth.middleware.js';

const router = Router();

const tokenRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { message: 'Demasiadas solicitudes desde esta IP. Intente más tarde.' }
  }
});

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * RUTAS DE AUDIT LOGS
 */

router.get(
  '/logs',
  authenticate,
  authorize(['admin', 'auditor']),
  asyncHandler(auditController.getAuditLogs.bind(auditController))
);

router.get(
  '/logs/:id',
  authenticate,
  authorize(['admin', 'auditor']),
  asyncHandler(auditController.getAuditLogById.bind(auditController))
);

router.post(
  '/logs',
  authenticate,
  authorize(['admin', 'system']),
  asyncHandler(auditController.createAuditLog.bind(auditController))
);

/**
 * RUTAS DE ONE-TIME TOKENS
 */

router.post(
  '/tokens',
  authenticate,
  asyncHandler(auditController.createOneTimeToken.bind(auditController))
);

router.post(
  '/tokens/consume',
  tokenRateLimiter,
  asyncHandler(auditController.consumeOneTimeToken.bind(auditController))
);

router.get(
  '/tokens/status',
  tokenRateLimiter,
  asyncHandler(auditController.checkTokenStatus.bind(auditController))
);

router.delete(
  '/tokens/cleanup',
  authenticate,
  authorize(['admin']),
  asyncHandler(auditController.cleanupExpiredTokens.bind(auditController))
);

export default router;