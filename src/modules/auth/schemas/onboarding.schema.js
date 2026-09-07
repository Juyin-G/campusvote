// src/modules/auth/schemas/onboarding.schema.js

import { z } from 'zod';
import { passwordSchema } from '../../../shared/utils/passwordPolicy.js';

// Opción 1 — activar la cuenta con el token de la invitación
export const activateAccountSchema = z.object({
  body: z.object({
    token: z.string().min(1, 'El token es obligatorio'),
    new_password: passwordSchema,
  }),
});

// Cambio de contraseña dentro del onboarding (Opción 2)
export const onboardingChangePasswordSchema = z.object({
  body: z.object({
    current_password: z.string().min(8, 'Como mínimo 8 caracteres').max(100),
    new_password: passwordSchema,
  }),
});

// Verificar el primer código TOTP y habilitar 2FA
export const onboardingVerifyTotpSchema = z.object({
  body: z.object({
    code: z.string().length(6, 'El código debe tener 6 dígitos'),
  }),
});