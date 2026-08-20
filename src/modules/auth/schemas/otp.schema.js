import { z } from 'zod';

/**
 * Schema para verificar y activar TOTP durante setup
 */
export const verifyTotpSchema = z
  .object({
    code: z
      .string()
      .length(6, 'El código debe tener exactamente 6 dígitos')
      .regex(/^\d+$/, 'El código solo puede contener números')
      .optional(),
    token: z
      .string()
      .length(6, 'El código debe tener exactamente 6 dígitos')
      .regex(/^\d+$/, 'El código solo puede contener números')
      .optional(),
  })
  .refine((data) => data.code || data.token, {
    message: 'Se requiere el código TOTP (campo code o token)',
    path: ['code'],
  });

/**
 * Schema para verificar TOTP o código de respaldo durante el login
 */
export const verifyLoginSchema = z
  .object({
    code: z
      .string()
      .length(6, 'El código debe tener 6 dígitos')
      .regex(/^\d+$/, 'El código solo puede contener números')
      .optional(),
    token: z
      .string()
      .length(6, 'El código debe tener 6 dígitos')
      .regex(/^\d+$/, 'El código solo puede contener números')
      .optional(),
    backupCode: z
      .string()
      .length(8, 'El código de respaldo debe tener 8 caracteres')
      .regex(/^[a-zA-Z0-9]+$/, 'Código de respaldo inválido')
      .optional(),
  })
  .refine((data) => data.code || data.token || data.backupCode, {
    message: 'Se requiere code, token o backupCode',
    path: ['code'],
  });

// Alias para mantener compatibilidad si se importa con este nombre en auth.routes.js
export const verifyLoginTotpSchema = verifyLoginSchema;

/**
 * Schema para deshabilitar 2FA
 */
export const disableTotpSchema = z.object({
  password: z
    .string()
    .min(8, 'Se requiere contraseña válida para deshabilitar 2FA')
    .optional(),
});

export default {
  verifyTotpSchema,
  verifyLoginSchema,
  verifyLoginTotpSchema,
  disableTotpSchema,
};