// src/modules/auth/routes/onboarding.routes.js
// Primer acceso de administradores (Opción 1 email / Opción 2 sin email).
// Todas las rutas que requieren sesión usan tokens con purpose=ONBOARDING.

import { Router } from 'express';
import * as onboardingController from '../controllers/onboarding.controller.js';
import {
  authenticateAllowPending,
  requireOnboarding,
} from '../../../middlewares/auth.middleware.js';
import { validate } from '../../../middlewares/validate.middleware.js';
import {
  activateAccountSchema,
  onboardingChangePasswordSchema,
  onboardingVerifyTotpSchema,
} from '../schemas/onboarding.schema.js';
import { authLimiter, loginLimiter } from '../../../middlewares/rateLimiter.middleware.js';

const router = Router();

// Opción 1 — el admin activa la cuenta con el enlace de la invitación
router.post(
  '/activate',
  loginLimiter,
  validate(activateAccountSchema),
  onboardingController.activateAccount
);

// Generar secreto TOTP + QR para el admin en su primer acceso
router.post(
  '/totp/setup',
  authenticateAllowPending,
  requireOnboarding,
  authLimiter,
  onboardingController.setupTotp
);

// Validar el primer código TOTP y habilitar 2FA
router.post(
  '/totp/verify',
  authenticateAllowPending,
  requireOnboarding,
  authLimiter,
  validate(onboardingVerifyTotpSchema),
  onboardingController.verifyTotp
);

// Cambiar la contraseña temporal (Opción 2)
router.post(
  '/password',
  authenticateAllowPending,
  requireOnboarding,
  authLimiter,
  validate(onboardingChangePasswordSchema),
  onboardingController.changePassword
);

// Finaliza el onboarding y emite el JWT de acceso completo
router.post(
  '/finalize',
  authenticateAllowPending,
  requireOnboarding,
  loginLimiter,
  onboardingController.finalize
);

export default router;