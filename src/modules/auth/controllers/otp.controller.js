import * as otpService from '../services/otp.service.js';
import { sendSuccess, asyncHandler } from '../../../shared/utils/index.js';
import { ApiError } from '../../../shared/errors/ApiError.js';
import { HTTP_STATUS } from '../../../constants/index.js';

// El JWT se firma con userId; se acepta id como respaldo (igual que en users)
const actorId = (user) => user?.userId ?? user?.id;

export const setupTotp = asyncHandler(async (req, res) => {
  const userId = actorId(req.user);
  const result = await otpService.setupTotp(userId);

  return sendSuccess(
    res,
    {
      secret: result.secret,
      uri: result.uri,
      backupCodes: result.backupCodes,
    },
    'Escanea el código QR con tu app de autenticación',
    { requestId: req.requestId },
    HTTP_STATUS.OK
  );
});

export const verifyTotp = asyncHandler(async (req, res) => {
  const userId = actorId(req.user);
  const { code } = req.body;

  const result = await otpService.verifyAndEnableTotp(userId, code);

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
  const { code, backupCode } = req.body;

  let result;

  if (backupCode) {
    result = await otpService.verifyBackupCodeLogin(userId, backupCode);
  } else if (code) {
    result = await otpService.verifyLoginTotp(userId, code);
  } else {
    throw ApiError.badRequest('Se requiere code o backupCode');
  }

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
  const result = await otpService.disableTotp(userId);

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