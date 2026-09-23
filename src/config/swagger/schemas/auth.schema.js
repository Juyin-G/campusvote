/**
 * @file auth.schema.js
 * @description Schemas para autenticación local (login, tokens y 2FA)
 */

const LoginRequestSchema = {
  type: 'object',
  required: ['email', 'password'],
  properties: {
    email: {
      type: 'string',
      format: 'email',
      example: 'usuario@universidad.edu',
    },
    password: {
      type: 'string',
      format: 'password',
      example: 'MiPassword123!',
      minLength: 8,
    },
  },
};

const LoginResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean', example: true },
    data: {
      type: 'object',
      properties: {
        user: { $ref: '#/components/schemas/User' },
        requiresOnboarding: {
          type: 'boolean',
          description: 'true si la cuenta debe completar onboarding (rol sin 2FA configurado)',
          example: true,
        },
        requiresTotp: {
          type: 'boolean',
          description: 'true si el usuario tiene TOTP habilitado y debe verificarlo antes de obtener sesión',
          example: false,
        },
        tempToken: {
          type: 'string',
          description: 'Token temporal de propósito limitado (purpose=ONBOARDING o TOTP_PENDING). Solo presente en etapas de staging.',
          example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        },
        mustChangePassword: { type: 'boolean', example: true },
        email: { type: 'string', format: 'email' },
        token: {
          type: 'string',
          description: 'JWT definitivo. Solo presente en sesión completa (SUPERADMIN o tras TOTP/onboarding).',
          example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        },
        refreshToken: {
          type: 'string',
          description: 'Refresh token opaco. Solo presente en sesión completa.',
        },
        expiresIn: { type: 'integer', example: 3600 },
      },
    },
  },
};

const RegisterRequestSchema = {
  type: 'object',
  required: [
    'username',
    'email',
    'password',
    'institutional_id',
    'first_name',
    'last_name',
  ],
  properties: {
    username: {
      type: 'string',
      example: 'jperez',
      minLength: 3,
      maxLength: 50,
    },
    email: {
      type: 'string',
      format: 'email',
      example: 'juan.perez@universidad.edu',
    },
    password: {
      type: 'string',
      format: 'password',
      example: 'MiPassword123!',
      minLength: 8,
      description: 'Mínimo 8 caracteres',
    },
    institutional_id: {
      type: 'string',
      example: '20210123',
    },
    first_name: {
      type: 'string',
      example: 'Juan',
      maxLength: 150,
    },
    last_name: {
      type: 'string',
      example: 'Pérez',
      maxLength: 150,
    },
  },
};

const PasswordResetRequestSchema = {
  type: 'object',
  required: ['email'],
  properties: {
    email: {
      type: 'string',
      format: 'email',
      example: 'usuario@universidad.edu',
    },
  },
};

const PasswordResetConfirmSchema = {
  type: 'object',
  required: ['token', 'new_password'],
  properties: {
    token: {
      type: 'string',
      description: 'Token de recuperación recibido por email',
    },
    new_password: {
      type: 'string',
      format: 'password',
      minLength: 8,
      example: 'NuevaPassword123!',
    },
  },
};

const TwoFactorSetupSchema = {
  type: 'object',
  properties: {
    secret: {
      type: 'string',
      description: 'Secreto base32 para la app autenticadora',
    },
    qr_code: {
      type: 'string',
      format: 'uri',
      description: 'URL del código QR para escanear',
    },
    backup_codes: {
      type: 'array',
      items: { type: 'string' },
      description: 'Códigos de respaldo (guárdalos en lugar seguro)',
    },
  },
};

export default {
  LoginRequest: LoginRequestSchema,
  LoginResponse: LoginResponseSchema,
  RegisterRequest: RegisterRequestSchema,
  PasswordResetRequest: PasswordResetRequestSchema,
  PasswordResetConfirm: PasswordResetConfirmSchema,
  TwoFactorSetup: TwoFactorSetupSchema,
};