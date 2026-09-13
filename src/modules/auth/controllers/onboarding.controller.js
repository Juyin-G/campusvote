// src/modules/auth/controllers/onboarding.controller.js
// Controladores del primer acceso de administradores (Opción 1 email /
// Opción 2 credenciales temporales).

import * as authService from '../services/auth.service.js';
import * as userService from '../../users/user.service.js';
import asyncHandler from '../../../shared/utils/asyncHandler.js';
import { sendSuccess } from '../../../shared/utils/apiResponse.js';
import { HTTP_STATUS } from '../../../constants/httpStatus.js';
import MESSAGES from '../../../constants/messages.js';

export const activateAccount = asyncHandler(async (req, res) => {
  const result = await authService.activateAccount(
    req.body.token,
    req.body.new_password
  );

  return sendSuccess(
    res,
    result,
    'Cuenta activada. Configura tu autenticador para continuar.',
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

export const changePassword = asyncHandler(async (req, res) => {
  const result = await userService.changeMyPassword(req.user.userId, {
    currentPassword: req.body.current_password,
    newPassword: req.body.new_password,
  });

  return sendSuccess(
    res,
    result,
    MESSAGES.USER.PASSWORD_CHANGED_SUCCESS,
    { requestId: req.requestId },
    HTTP_STATUS.OK
  );
});

export const finalize = asyncHandler(async (req, res) => {
  const ipAddress = req.ip || req.headers['x-forwarded-for'] || null;
  const userAgent = req.headers['user-agent'] || null;

  const result = await authService.finalizeOnboarding(req.user.userId, {
    ipAddress,
    userAgent,
  });

  return sendSuccess(
    res,
    result,
    'Onboarding completado. Acceso entregado.',
    { requestId: req.requestId },
    HTTP_STATUS.OK
  );
});