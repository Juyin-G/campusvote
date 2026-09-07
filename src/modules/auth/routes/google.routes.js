// src/modules/auth/routes/google.routes.js
import { Router } from 'express';
import * as googleAuthController from '../controllers/google-auth.controller.js';
import { authLimiter } from '../../../middlewares/rateLimiter.middleware.js';
import { validate } from '../../../middlewares/validate.middleware.js';
import { googleVerifySchema } from '../schemas/auth.schema.js';

const router = Router();

// Redirige el navegador hacia Google
router.get('/google', authLimiter, googleAuthController.redirectToGoogle);

// Callback de Google (intercambio de código)
router.get('/google/callback', authLimiter, googleAuthController.googleCallback);

// Verificación de código en JSON (apps móviles / SPA)
router.post(
  '/google/verify',
  authLimiter,
  validate(googleVerifySchema),
  googleAuthController.verifyGoogleCode
);

export default router;
