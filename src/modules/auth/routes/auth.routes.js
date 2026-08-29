/**
 * Auth Routes
 * Endpoints de autenticación, 2FA, password reset, email verification
 */
import { Router } from 'express';
import * as authController from '../controllers/auth.controller.js';
import {
  authenticate,
  authenticateAllowPending,
  requireTotpPending,
} from '../../../middlewares/auth.middleware.js';
import { validate } from '../../../middlewares/validate.middleware.js';
import { authLimiter, loginLimiter } from '../../../middlewares/rateLimiter.middleware.js';
import {
  loginSchema,
  registerSchema,
  verifyTotpSchema,
  verifyLoginTotpSchema,
  disableTotpSchema,
  requestPasswordResetSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  refreshSchema,
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

// Paso 2 del Login: Verificación TOTP (o Código de Respaldo)
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
// Es el único endpoint público de auth que consume un token, así que lleva
// el mismo limitador que el resto para no dejarlo abierto a fuerza bruta.
router.post(
  '/verify-email',
  authLimiter,
  validate(verifyEmailSchema),
  authController.verifyEmail
);

// Salida para quien se registró y no recibió el correo (SMTP caído, spam...).
// Responde siempre igual para no revelar qué correos están registrados.
router.post(
  '/verify-email/resend',
  authLimiter,
  validate(resendVerificationSchema),
  authController.resendVerification
);

// Renovación de sesión (access token) a partir de un refresh token válido
router.post(
  '/refresh',
  authLimiter,
  validate(refreshSchema),
  authController.refreshTokens
);

// ═══════════════════════════════════════════
// RUTAS PROTEGIDAS
// ═══════════════════════════════════════════

router.post('/logout', authenticate, authController.logout);
router.get('/me', authenticate, authController.getProfile);

// Configuración, Activación y Desactivación 2FA
router.post(
  '/totp/setup',
  authenticate,
  authLimiter,
  authController.setupTotp
);

router.post(
  '/totp/verify',
  authenticate,
  authLimiter,
  validate(verifyTotpSchema),
  authController.verifyTotp
);

router.post(
  '/totp/disable',
  authenticate,
  authLimiter,
  validate(disableTotpSchema),
  authController.disableTotp
);

export default router;