/**
 * Auth Routes
 * Endpoints de autenticación, 2FA, password reset, email verification
 */
import { Router } from 'express';
import * as authController from '../controllers/auth.controller.js';
import { authenticate, authenticateAllowPending, requireTotpPending } from '../../../middlewares/auth.middleware.js';
import { validate } from '../../../middlewares/validate.middleware.js';
import { authLimiter, loginLimiter } from '../../../middlewares/rateLimiter.middleware.js';
import {
  loginSchema,
  registerSchema,
  verifyTotpSchema,
  verifyLoginTotpSchema,
  requestPasswordResetSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from '../schemas/auth.schema.js';

const router = Router();

// ═══════════════════════════════════════════
// RUTAS PÚBLICAS
// ═══════════════════════════════════════════

// Registro y Login
router.post(
  '/register',
  authLimiter,
  validate(registerSchema),
  authController.register
);

router.post(
  '/login',
  loginLimiter,
  validate(loginSchema),
  authController.login
);

// Paso 2 del Login: Verificación TOTP
router.post(
  '/totp/login-verify',
  loginLimiter,
  authenticateAllowPending,
  requireTotpPending,
  validate(verifyLoginTotpSchema),
  authController.verifyLoginTotp
);

// Recuperación de Contraseña
router.post(
  '/password/forgot',
  authLimiter,
  validate(requestPasswordResetSchema),
  authController.requestPasswordReset
);

router.post(
  '/password/reset',
  authLimiter,
  validate(resetPasswordSchema),
  authController.resetPassword
);

// Verificación de Email
router.post(
  '/verify-email',
  validate(verifyEmailSchema),
  authController.verifyEmail
);

// ═══════════════════════════════════════════
// RUTAS PROTEGIDAS
// ═══════════════════════════════════════════

router.post('/logout', authenticate, authController.logout);
router.get('/me', authenticate, authController.getProfile);

// Configuración y Activación 2FA
router.post(
  '/totp/setup',
  authenticate,
  authController.setupTotp
);

router.post(
  '/totp/verify',
  authenticate,
  validate(verifyTotpSchema),
  authController.verifyTotp
);

export default router;