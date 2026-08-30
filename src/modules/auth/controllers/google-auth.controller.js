// src/modules/auth/controllers/google-auth.controller.js
import * as googleAuthService from '../services/google-auth.service.js';
import asyncHandler from '../../../shared/utils/asyncHandler.js';
import { sendSuccess } from '../../../shared/utils/apiResponse.js';
import { HTTP_STATUS } from '../../../constants/httpStatus.js';
import MESSAGES from '../../../constants/messages.js';
import env from '../../../config/env.js';
import crypto from 'node:crypto';
import logger from '../../../config/logger.js';

// Genera token anti-CSRF para el flujo OAuth
const generateState = () => crypto.randomBytes(16).toString('hex');

/**
 * GET /auth/google — redirige al navegador a Google para autorizar.
 */
export const redirectToGoogle = asyncHandler(async (req, res) => {
  const state = generateState();
  const authUrl = googleAuthService.getAuthUrl(state);

  logger.info('Redirección a Google OAuth iniciada', { requestId: req.requestId });

  return res.redirect(authUrl);
});

/**
 * GET /auth/google/callback — recibe el código y emite la sesión.
 */
export const googleCallback = asyncHandler(async (req, res) => {
  const code = req.query.code;

  if (!code) {
    const redirect = `${env.FRONTEND_URL}/login?error=google_denied`;
    return res.redirect(redirect);
  }

  try {
    const session = await googleAuthService.authenticateWithGoogle(code);

    logger.info('Login con Google exitoso', {
      email: session.user?.email,
      requestId: req.requestId,
    });

    // Redirige al frontend con un token de sesión (código de acceso).
    return res.redirect(
      `${env.FRONTEND_URL}/oauth/callback?token=${encodeURIComponent(session.token)}&refreshToken=${encodeURIComponent(session.refreshToken)}`
    );
  } catch (error) {
    logger.warn('Login con Google falló', {
      message: error.message,
      requestId: req.requestId,
    });
    const redirect = `${env.FRONTEND_URL}/login?error=google_auth_failed`;
    return res.redirect(redirect);
  }
});

/**
 * POST /auth/google/verify — recibe el código de Google y devuelve la sesión
 * en JSON (para apps móviles / SPAs que no usan redirect).
 */
export const verifyGoogleCode = asyncHandler(async (req, res) => {
  const session = await googleAuthService.authenticateWithGoogle(req.body.code);

  return sendSuccess(
    res,
    session,
    MESSAGES.GOOGLE_LOGIN_SUCCESS || 'Login con Google exitoso',
    { requestId: req.requestId },
    HTTP_STATUS.OK
  );
});
