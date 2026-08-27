/**
 * Auth Controller
 * Manejo de capa HTTP y delegación a Auth Service
 */
import * as authService from '../services/auth.service.js';
import { disableTotp as disableTotpService } from '../services/auth.totp.service.js';
import asyncHandler from '../../../shared/utils/asyncHandler.js';
import { sendSuccess } from '../../../shared/utils/apiResponse.js';
import { HTTP_STATUS } from '../../../constants/httpStatus.js';
import MESSAGES from '../../../constants/messages.js';
import logger from '../../../config/logger.js';

// Helper para sanitizar logs y prevenir Log Injection
const safe = (input) => String(input ?? '').replace(/[\r\n]/g, '');

export const login = asyncHandler(async (req, res) => {
  const ipAddress = req.ip || req.headers['x-forwarded-for'] || null;
  const userAgent = req.headers['user-agent'] || null;

  const result = await authService.login({
    ...req.body,
    ipAddress,
    userAgent,
  });

  logger.info(`Intento de login procesado: ${safe(req.body?.email || 'N/A')}`, {
    requestId: req.requestId,
  });

  const message = result.requiresTotp
    ? MESSAGES.AUTH.TWO_FACTOR_REQUIRED
    : MESSAGES.AUTH.LOGIN_SUCCESS;

  return sendSuccess(
    res,
    result,
    message,
    { requestId: req.requestId },
    HTTP_STATUS.OK
  );
});

export const register = asyncHandler(async (req, res) => {
  const result = await authService.register(req.body);

  logger.info(`Registro exitoso: ${safe(req.body?.email || 'N/A')}`, {
    requestId: req.requestId,
  });

  // El alta se confirma aunque el correo no haya salido; en ese caso se indica
  // al usuario que puede pedir el reenvío en lugar de dejarlo sin salida.
  const message = result.verificationEmailSent
    ? MESSAGES.USER.CREATED_SUCCESS
    : MESSAGES.AUTH.REGISTER_EMAIL_FAILED;

  return sendSuccess(
    res,
    result,
    message,
    { requestId: req.requestId },
    HTTP_STATUS.CREATED
  );
});

export const resendVerification = asyncHandler(async (req, res) => {
  const result = await authService.resendVerification(req.body.email);

  return sendSuccess(
    res,
    result,
    MESSAGES.AUTH.EMAIL_VERIFICATION_SENT,
    { requestId: req.requestId },
    HTTP_STATUS.OK
  );
});

export const logout = asyncHandler(async (req, res) => {
  const tokenHash = req.tokenHash || null;

  await authService.logout({
    userId: req.user?.userId,
    tokenHash,
  });

  return sendSuccess(
    res,
    { loggedOut: true },
    MESSAGES.AUTH.LOGOUT_SUCCESS,
    { requestId: req.requestId },
    HTTP_STATUS.OK
  );
});

export const getProfile = asyncHandler(async (req, res) => {
  const profile = await authService.getProfile(req.user.userId);

  return sendSuccess(
    res,
    profile,
    'Perfil de usuario obtenido',
    { requestId: req.requestId },
    HTTP_STATUS.OK
  );
});

export const setupTotp = asyncHandler(async (req, res) => {
  const result = await authService.setupTotp(req.user.userId);

  return sendSuccess(
    res,
    result,
    'Código QR y secreto TOTP generados',
    { requestId: req.requestId },
    HTTP_STATUS.OK
  );
});

export const verifyTotp = asyncHandler(async (req, res) => {
  const result = await authService.verifyTotp(req.user.userId, req.body.code);

  return sendSuccess(
    res,
    result,
    MESSAGES.AUTH.TWO_FACTOR_ENABLED_SUCCESS,
    { requestId: req.requestId },
    HTTP_STATUS.OK
  );
});

export const verifyLoginTotp = asyncHandler(async (req, res) => {
  // Recibe el objeto con { code } o { backupCode } normalizado por Zod
  const result = await authService.verifyLoginTotp(
    req.user.userId,
    req.body
  );

  return sendSuccess(
    res,
    result,
    MESSAGES.AUTH.LOGIN_SUCCESS,
    { requestId: req.requestId },
    HTTP_STATUS.OK
  );
});

export const disableTotp = asyncHandler(async (req, res) => {
  const result = await disableTotpService(
    req.user.userId,
    req.body.password
  );

  return sendSuccess(
    res,
    result,
    MESSAGES.AUTH.OTP_DISABLED || '2FA deshabilitado correctamente',
    { requestId: req.requestId },
    HTTP_STATUS.OK
  );
});

export const requestPasswordReset = asyncHandler(async (req, res) => {
  const result = await authService.requestPasswordReset(req.body.email);

  return sendSuccess(
    res,
    result,
    MESSAGES.AUTH.PASSWORD_RESET_REQUESTED,
    { requestId: req.requestId },
    HTTP_STATUS.OK
  );
});

export const resetPassword = asyncHandler(async (req, res) => {
  const { token, newPassword } = req.body;
  const result = await authService.resetPassword(token, newPassword);

  return sendSuccess(
    res,
    result,
    MESSAGES.AUTH.PASSWORD_RESET_SUCCESS,
    { requestId: req.requestId },
    HTTP_STATUS.OK
  );
});

export const verifyEmail = asyncHandler(async (req, res) => {
  const result = await authService.verifyEmail(req.body.token);

  return sendSuccess(
    res,
    result,
    MESSAGES.AUTH.EMAIL_VERIFIED_SUCCESS,
    { requestId: req.requestId },
    HTTP_STATUS.OK
  );
});