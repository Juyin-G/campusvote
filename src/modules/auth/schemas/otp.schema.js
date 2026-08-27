import { z } from 'zod';

/**
 * Normaliza códigos TOTP y quita espacios
 */
const totpCodeSchema = z
  .string()
  .trim()
  .transform((val) => val.replace(/\s+/g, ''))
  .pipe(
    z
      .string()
      .length(6, 'El código debe tener exactamente 6 dígitos')
      .regex(/^\d+$/, 'El código solo puede contener números')
  );

/**
 * Normaliza códigos de respaldo (elimina guiones y espacios)
 */
const backupCodeSchema = z
  .string()
  .trim()
  .transform((val) => val.replace(/[- ]/g, ''))
  .pipe(
    z
      .string()
      .length(8, 'El código de respaldo debe tener 8 caracteres alfanuméricos')
      .regex(/^[a-zA-Z0-9]+$/, 'Código de respaldo inválido')
  );

/**
 * Schema para verificar y activar TOTP durante setup
 */
export const verifyTotpSchema = z
  .object({
    body: z
      .object({
        code: totpCodeSchema.optional(),
        token: totpCodeSchema.optional(),
      })
      .refine((data) => Boolean(data.code || data.token), {
        message: 'Se requiere el código TOTP (campo code o token)',
        path: ['code'],
      })
      .transform((data) => ({
        ...data,
        code: data.code ?? data.token,
      })),
  });

/**
 * Schema para verificar TOTP o código de respaldo durante el login
 */
export const verifyLoginSchema = z
  .object({
    body: z
      .object({
        code: totpCodeSchema.optional(),
        token: totpCodeSchema.optional(),
        backupCode: backupCodeSchema.optional(),
      })
      .refine((data) => Boolean(data.code || data.token || data.backupCode), {
        message: 'Se requiere el código TOTP (code/token) o un código de respaldo (backupCode)',
        path: ['code'],
      })
      .transform((data) => ({
        ...data,
        code: data.code ?? data.token,
      })),
  });

export const verifyLoginTotpSchema = verifyLoginSchema;

/**
 * Schema para deshabilitar 2FA (Requiere confirmación de contraseña)
 */
export const disableTotpSchema = z.object({
  body: z.object({
    password: z
      .string()
      .min(1, 'Se requiere la contraseña actual para deshabilitar 2FA'),
  }),
});

export default {
  verifyTotpSchema,
  verifyLoginSchema,
  verifyLoginTotpSchema,
  disableTotpSchema,
};