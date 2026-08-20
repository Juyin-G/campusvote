import { z } from 'zod';

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email('Email inválido'),
    password: z.string().min(1, 'La contraseña es obligatoria'),
  }),
});

export const registerSchema = z.object({
  body: z.object({
    username: z.string().min(3, 'Mínimo 3 caracteres'),
    email: z.string().email('Email inválido'),
    password: z.string().min(8, 'Mínimo 8 caracteres'),
    firstName: z.string().min(1, 'El nombre es obligatorio'),
    lastName: z.string().min(1, 'El apellido es obligatorio'),
    institutionalId: z.string().min(1, 'El ID institucional es obligatorio'),
  }),
});

export const totpTokenSchema = z.object({
  body: z.object({
    token: z
      .string()
      .regex(/^\d{6}$/, 'El código TOTP debe tener exactamente 6 dígitos'),
  }),
});
