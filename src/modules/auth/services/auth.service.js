// src/modules/auth/services/auth.service.js
// Orquestador del módulo de autenticación.

export {
  login,
  logout,
  refreshSession,
} from './auth.session.service.js';
export {
  activateAccount,
  finalizeOnboarding,
  getProfile,
  requestPasswordReset,
  resetPassword,
  verifyEmail,
  resendVerification,
} from './auth.lifecycle.service.js';
export {
  setupTotp,
  verifyAndEnableTotp,
  verifyTotp,
  verifyLoginTotp,
  verifyBackupCodeLogin,
  disableTotp,
  getTwoFactorStatus,
} from './auth.totp.service.js';

import {
  login,
  logout,
  refreshSession,
} from './auth.session.service.js';
import {
  activateAccount,
  finalizeOnboarding,
  getProfile,
  requestPasswordReset,
  resetPassword,
  verifyEmail,
  resendVerification,
} from './auth.lifecycle.service.js';
import {
  setupTotp,
  verifyAndEnableTotp,
  verifyTotp,
  verifyLoginTotp,
  verifyBackupCodeLogin,
  disableTotp,
  getTwoFactorStatus,
} from './auth.totp.service.js';

export default {
  login,
  logout,
  refreshSession,
  activateAccount,
  finalizeOnboarding,
  getProfile,
  requestPasswordReset,
  resetPassword,
  verifyEmail,
  resendVerification,
  setupTotp,
  verifyAndEnableTotp,
  verifyTotp,
  verifyLoginTotp,
  verifyBackupCodeLogin,
  disableTotp,
  getTwoFactorStatus,
};
