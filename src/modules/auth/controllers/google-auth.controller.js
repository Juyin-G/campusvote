// src/modules/auth/controllers/google-auth.controller.js
import * as googleAuthService from '../services/google-auth.service.js';
import asyncHandler from '../../../shared/utils/asyncHandler.js';
import { sendSuccess } from '../../../shared/utils/apiResponse.js';
import { HTTP_STATUS } from '../../../constants/httpStatus.js';
import MESSAGES from '../../../constants/messages.js';
import env from '../../../config/env.js';
import crypto from 'node:crypto';
import logger from '../../../config/logger.js';

const OAUTH_STATE_COOKIE = 'campusvote_oauth_state';
const ACCESS_COOKIE = 'campusvote_access';
const REFRESH_COOKIE = 'campusvote_refresh';

const cookieOptions = (maxAge) => ({
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge,
  path: '/',
});

/**
 * GET /auth/google — redirige al navegador a Google para autorizar.
 */
export const redirectToGoogle = asyncHandler(async (req, res) => {
  const state = googleAuthService.createOAuthState();
  const authUrl = googleAuthService.getAuthUrl(state);
  res.cookie(OAUTH_STATE_COOKIE, state, cookieOptions(10 * 60 * 1000));

  logger.info('Redirección a Google OAuth iniciada', { requestId: req.requestId });

  return res.redirect(authUrl);
});

/**
 * GET /auth/google/callback — recibe el código y emite la sesión.
 */
export const googleCallback = asyncHandler(async (req, res) => {
  const code = req.query.code;
  const state = req.query.state;

  if (!code || !state || !req.headers.cookie?.includes(`${OAUTH_STATE_COOKIE}=`)) {
    const redirect = `${env.FRONTEND_URL}/login?error=google_denied`;
    return res.redirect(redirect);
  }

  try {
    const stateCookie = req.headers.cookie
      .split(';')
      .map((value) => value.trim())
      .find((value) => value.startsWith(`${OAUTH_STATE_COOKIE}=`))
      ?.slice(`${OAUTH_STATE_COOKIE}=`.length);
    if (
      !stateCookie ||
      !crypto.timingSafeEqual(Buffer.from(state), Buffer.from(stateCookie)) ||
      !googleAuthService.verifyOAuthState(state)
    ) {
      return res.redirect(`${env.FRONTEND_URL}/login?error=google_state_invalid`);
    }

    const session = await googleAuthService.authenticateWithGoogle(code);

    logger.info('Login con Google exitoso', {
      email: session.user?.email,
      requestId: req.requestId,
    });

    res.clearCookie(OAUTH_STATE_COOKIE, { path: '/' });
    res.cookie(ACCESS_COOKIE, session.token, cookieOptions(24 * 60 * 60 * 1000));
    res.cookie(REFRESH_COOKIE, session.refreshToken, cookieOptions(7 * 24 * 60 * 60 * 1000));
    return res.redirect(`${env.FRONTEND_URL}/oauth/callback`);
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
