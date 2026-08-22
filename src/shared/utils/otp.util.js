/**
 * Utilidad TOTP para 2FA
 */
import crypto from 'node:crypto';
import QRCode from 'qrcode';
import { generateSecret, generateURI, verifySync } from 'otplib';

import { OTP_CONSTANTS } from '../../constants/otp.constants.js';

const totpOptions = {
  digits: OTP_CONSTANTS.TOTP_DIGITS,
  period: OTP_CONSTANTS.TOTP_STEP,
};

export const generateTotpSecret = () => {
  return generateSecret();
};

export const generateTotpUri = (secret, email, appName = 'CampusVote') => {
  return generateURI({
    issuer: appName,
    label: email,
    secret,
    ...totpOptions,
  });
};

export const generateQrCode = async (otpauthUri) => {
  try {
    return await QRCode.toDataURL(otpauthUri);
  } catch {
    throw new Error('Error al generar la imagen QR');
  }
};

export const verifyTotp = (token, secret) => {
  try {
    if (!token || !secret) return false;

    const cleanToken = String(token).trim();
    const result = verifySync({
      secret,
      token: cleanToken,
      epochTolerance: OTP_CONSTANTS.TOTP_STEP * OTP_CONSTANTS.TOTP_WINDOW,
      ...totpOptions,
    });

    return result.valid;
  } catch {
    return false;
  }
};

export const generateBackupCodes = (
  count = OTP_CONSTANTS.BACKUP_CODES_COUNT,
) => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const codes = [];

  for (let i = 0; i < count; i++) {
    let code = '';
    const bytes = crypto.randomBytes(OTP_CONSTANTS.BACKUP_CODE_LENGTH);
    for (let j = 0; j < OTP_CONSTANTS.BACKUP_CODE_LENGTH; j++) {
      code += chars[bytes[j] % chars.length];
    }
    codes.push(code);
  }

  return codes;
};

export const hashBackupCode = (code) => {
  if (!code) return '';
  return crypto
    .createHash('sha256')
    .update(code.trim().toUpperCase())
    .digest('hex');
};

export const verifyBackupCode = (code, hashedCodes) => {
  if (!code || !Array.isArray(hashedCodes) || hashedCodes.length === 0) {
    return { valid: false, index: -1 };
  }
  const codeHash = hashBackupCode(code);
  const index = hashedCodes.indexOf(codeHash);
  return { valid: index !== -1, index };
};

export default {
  generateTotpSecret,
  generateTotpUri,
  generateQrCode,
  verifyTotp,
  generateBackupCodes,
  hashBackupCode,
  verifyBackupCode,
};
