/**
 * Utilidad TOTP para 2FA
 */
import { createRequire } from 'node:module';
import crypto from 'node:crypto';
import QRCode from 'qrcode';
import { OTP_CONSTANTS } from '../../constants/otp.constants.js';

// Carga segura CJS con fallback para otplib
const require = createRequire(import.meta.url);
const otplibPkg = require('otplib');
const authenticator = otplibPkg.authenticator || otplibPkg.default?.authenticator || otplibPkg;

// Configuración TOTP
authenticator.options = {
  window: OTP_CONSTANTS.TOTP_WINDOW,
  step: OTP_CONSTANTS.TOTP_STEP,
  digits: OTP_CONSTANTS.TOTP_DIGITS,
};

export const generateTotpSecret = () => {
  return authenticator.generateSecret();
};

export const generateTotpUri = (secret, email, appName = 'CampusVote') => {
  return authenticator.keyuri(email, appName, secret);
};

export const generateQrCode = async (otpauthUri) => {
  try {
    return await QRCode.toDataURL(otpauthUri);
  } catch (error) {
    throw new Error('Error al generar la imagen QR');
  }
};

export const verifyTotp = (token, secret) => {
  try {
    if (!token || !secret) return false;
    const cleanToken = String(token).trim();
    return authenticator.verify({ token: cleanToken, secret });
  } catch {
    return false;
  }
};

export const generateBackupCodes = (
  count = OTP_CONSTANTS.BACKUP_CODES_COUNT
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