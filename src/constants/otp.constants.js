export const OTP_CONSTANTS = {
  TOTP_WINDOW: 1,
  TOTP_STEP: 30,
  TOTP_DIGITS: 6,

  BACKUP_CODES_COUNT: 10,
  BACKUP_CODE_LENGTH: 8,

  STATUS: {
    PENDING: 'PENDING',
    ENABLED: 'ENABLED',
    DISABLED: 'DISABLED',
  },

  MESSAGES: {
    OTP_ENABLED: 'Autenticación 2FA activada correctamente',
    OTP_DISABLED: 'Autenticación 2FA desactivada correctamente',
    OTP_CODE_INVALID: 'Código TOTP inválido',
    OTP_ALREADY_ENABLED: '2FA ya está activado',
    OTP_NOT_ENABLED: '2FA no está activado',
    BACKUP_CODE_USED: 'Código de respaldo ya utilizado',
    BACKUP_CODE_INVALID: 'Código de respaldo inválido',
  },
};

export default OTP_CONSTANTS;