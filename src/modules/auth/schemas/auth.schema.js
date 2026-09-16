import { z } from 'zod';

const EMAIL_INSTITUCIONAL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.(edu\.pe|edu)$/;

export const UserRoleEnum = z.enum([
  'STUDENT',
  'TEACHER',
  'ADMIN',
  'SUPERADMIN',
  'ELECTORAL_COMMISSION',
  'JURY',
]);

// Login
export const loginSchema = z.object({
  body: z.object({
    email: z.string().email('Email inválido').trim().toLowerCase(),
    password: z.string().min(1, 'La contraseña es obligatoria'),
  }),
});

// TOTP Setup
export const verifyTotpSchema = z.object({
  body: z.object({
    code: z.string().regex(/^\d{6}$/, 'El código TOTP debe tener exactamente 6 dígitos'),
  }),
});

// TOTP Login (Acepta código o backup code)
export const verifyLoginTotpSchema = z.object({
  body: z
    .object({
      code: z.string().regex(/^\d{6}$/, 'Código TOTP inválido').optional(),
      backupCode: z.string().min(8, 'Código de respaldo inválido').optional(),
    })
    .refine((data) => Boolean(data.code || data.backupCode), {
      message: 'Debes proporcionar el código TOTP o un código de respaldo',
    }),
});

// Solicitud de reset de contraseña
export const requestPasswordResetSchema = z.object({
  body: z.object({
    email: z.string().email('Email inválido').trim().toLowerCase(),
  }),
});

// Reset de contraseña
export const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string().min(1, 'El token es obligatorio'),
    newPassword: z
      .string()
      .min(8, 'Mínimo 8 caracteres')
      .regex(/[A-Z]/, 'Debe contener al menos una letra mayúscula')
      .regex(/[a-z]/, 'Debe contener al menos una letra minúscula')
      .regex(/\d/, 'Debe contener al menos un número'),
  }),
});

// Verificación de email
export const verifyEmailSchema = z.object({
  body: z.object({
    token: z.string().min(1, 'El token es obligatorio'),
  }),
});

// Deshabilitar TOTP
// Requiere la contraseña actual; opcionalmente acepta un código TOTP.
export const disableTotpSchema = z.object({
  body: z.object({
    password: z.string().min(1, 'La contraseña es obligatoria para desactivar TOTP'),
    code: z
      .string()
      .regex(/^\d{6}$/, 'El código TOTP debe tener exactamente 6 dígitos')
      .optional(),
  }),
});

// Reenviar email de verificación
export const resendVerificationSchema = z.object({
  body: z.object({
    email: z.string().email('Email inválido').trim().toLowerCase(),
  }),
});

// Renovación de sesión con refresh token
export const refreshSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1, 'El refresh token es obligatorio'),
  }),
});