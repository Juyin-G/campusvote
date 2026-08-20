import { z } from 'zod';

// Login
export const loginSchema = z.object({
  body: z.object({
    email: z.string().email('Email inválido').trim().toLowerCase(),
    password: z.string().min(1, 'La contraseña es obligatoria'),
  }),
});

// Registro
export const registerSchema = z.object({
  body: z.object({
    username: z.string().min(3, 'Mínimo 3 caracteres').trim(),
    email: z.string().email('Email inválido').trim().toLowerCase(),
    password: z.string().min(8, 'Mínimo 8 caracteres'),
    firstName: z.string().min(1, 'El nombre es obligatorio').trim(),
    lastName: z.string().min(1, 'El apellido es obligatorio').trim(),
    institutionalId: z.string().min(1, 'El ID institucional es obligatorio').trim(),
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
  body: z.object({
    code: z.string().optional(),
    backupCode: z.string().optional(),
  }).refine((data) => data.code || data.backupCode, {
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
    newPassword: z.string().min(8, 'Mínimo 8 caracteres'),
  }),
});

// Verificación de email
export const verifyEmailSchema = z.object({
  body: z.object({
    token: z.string().min(1, 'El token es obligatorio'),
  }),
});