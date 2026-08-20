import logger from '../../config/logger.js';
import { ok } from '../../common/helpers/response.helper.js';
import { asyncHandler } from '../../common/middlewares/asyncHandler.js';
import * as authService from './auth.service.js';

export const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body);

  logger.info(`Login procesado: ${req.body.email}`, {
    requestId: req.requestId,
  });

  return ok(res, {
    message: result.requiresTotp
      ? 'Inicio de sesión parcial: requiere verificación TOTP'
      : 'Inicio de sesión completado',
    data: result,
    requestId: req.requestId,
  });
});

export const logout = asyncHandler(async (req, res) => {
  await authService.logout({
    userId: req.user.userId,
    email: req.user.email,
  });

  logger.info(`Logout procesado: ${req.user.email}`, {
    requestId: req.requestId,
  });

  return ok(res, {
    message: 'Sesión cerrada correctamente',
    data: { loggedOut: true },
    requestId: req.requestId,
  });
});

export const setupTotp = asyncHandler(async (req, res) => {
  const result = await authService.setupTotp(req.user.userId);

  logger.info(`TOTP setup generado: ${req.user.email}`, {
    requestId: req.requestId,
  });

  return ok(res, {
    message:
      'Secreto TOTP generado. Escanea el código QR con tu app autenticadora',
    data: result,
    requestId: req.requestId,
  });
});

export const verifyTotp = asyncHandler(async (req, res) => {
  const result = await authService.verifyTotp(req.user.userId, req.body.token);

  logger.info(`TOTP verificado: ${req.user.email}`, {
    requestId: req.requestId,
  });

  return ok(res, {
    message:
      'TOTP verificado correctamente. La autenticación en dos pasos quedó habilitada',
    data: result,
    requestId: req.requestId,
  });
});

export const verifyLoginTotp = asyncHandler(async (req, res) => {
  const result = await authService.verifyLoginTotp(
    req.user.userId,
    req.body.token,
  );

  logger.info(`Login TOTP completado: ${req.user.email}`, {
    requestId: req.requestId,
  });

  return ok(res, {
    message: 'Verificación TOTP completada. Sesión iniciada',
    data: result,
    requestId: req.requestId,
  });
});

export default {
  login,
  logout,
  setupTotp,
  verifyTotp,
  verifyLoginTotp,
};
