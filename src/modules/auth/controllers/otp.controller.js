import * as otpService from '../services/auth.totp.service.js';
import { sendSuccess, asyncHandler } from '../../../shared/utils/index.js';
import { HTTP_STATUS } from '../../../constants/index.js';

// El JWT se firma con userId; se acepta id como respaldo.
const actorId = (user) => user?.userId ?? user?.id;

export const setupTotp = asyncHandler(async (req, res) => {
  const userId = actorId(req.user);
  const result = await otpService.setupTotp(userId);

  return sendSuccess(
    res,
    {
      secret: result.secret,
      uri: result.uri,
      qrCode: result.qrCode,
    },
    'Escanea el código QR con tu app de autenticación',
    { requestId: req.requestId },
    HTTP_STATUS.OK
  );
});

export const verifyTotp = asyncHandler(async (req, res) => {
  const userId = actorId(req.user);
  const result = await otpService.verifyAndEnableTotp(userId, req.body.code);

  return sendSuccess(
    res,
    {
      backupCodes: result.backupCodes,
    },
    result.message,
    { requestId: req.requestId },
    HTTP_STATUS.OK
  );
});

export const verifyLoginTotp = asyncHandler(async (req, res) => {
  const userId = actorId(req.user);

  // Delegación unificada al servicio (maneja internamente code o backupCode).
  const result = await otpService.verifyLoginTotp(userId, req.body);

  return sendSuccess(
    res,
    result,
    'Verificación exitosa',
    { requestId: req.requestId },
    HTTP_STATUS.OK
  );
});

export const disableTotp = asyncHandler(async (req, res) => {
  const userId = actorId(req.user);

  // Envía la contraseña obligatoria para verificar identidad antes de deshabilitar 2FA.
  const result = await otpService.disableTotp(userId, req.body.password);

  return sendSuccess(
    res,
    null,
    result.message,
    { requestId: req.requestId },
    HTTP_STATUS.OK
  );
});

export default {
  setupTotp,
  verifyTotp,
  verifyLoginTotp,
  disableTotp,
};