import { z } from 'zod';
import { ALL_ROLES } from '../../constants/roles.js';

const roleEnum = z.enum(ALL_ROLES);

// Validar parámetros con ID
export const userParamsSchema = z.object({
  params: z.object({
    id: z.string().uuid('ID inválido'),
  }),
});

// Listar usuarios
export const listUserSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
    role: roleEnum.optional(),
    search: z.string().max(100).optional(),
  }),
});

// Crear usuario
export const createUserSchema = z.object({
  body: z.object({
    username: z.string().min(3, 'Como mínimo 3 caracteres').max(50),
    email: z.string().email('Email inválido'),
    password: z.string().min(8, 'Como mínimo 8 caracteres').max(100),
    first_name: z.string().min(1, 'Como mínimo 1 carácter').max(50),
    last_name: z.string().min(1, 'Como mínimo 1 carácter').max(50),
    institutional_id: z.string().min(1, 'Como mínimo 1 carácter').max(50),
    role: roleEnum,
    organization_id: z.string().uuid('ID inválido').optional(),
  }),
});

// Actualizar usuario
export const updateUserSchema = z.object({
  params: z.object({
    id: z.string().uuid('ID inválido'),
  }),
  body: z
    .object({
      username: z.string().min(3, 'Como mínimo 3 caracteres').max(50).optional(),
      email: z.string().email('Email inválido').optional(),
      first_name: z.string().min(1, 'Como mínimo 1 carácter').max(50).optional(),
      last_name: z.string().min(1, 'Como mínimo 1 carácter').max(50).optional(),
      role: roleEnum.optional(),
      is_active: z.boolean().optional(),
      organization_id: z.string().uuid('ID inválido').optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'Al menos un campo debe ser proporcionado',
    }),
});

// Eliminar usuario
export const deleteUserSchema = z.object({
  params: z.object({
    id: z.string().uuid('ID inválido'),
  }),
});

// Cambiar rol de usuario
export const changeRoleSchema = z.object({
  params: z.object({
    id: z.string().uuid('ID inválido'),
  }),
  body: z.object({
    role: roleEnum,
  }),
});

// Cambiar estado de usuario
export const setActiveSchema = z.object({
  params: z.object({
    id: z.string().uuid('ID inválido'),
  }),
  body: z.object({
    is_active: z.boolean(),
  }),
});

// Cambiar contraseña
export const changePasswordSchema = z.object({
  body: z.object({
    current_password: z.string().min(8, 'Como mínimo 8 caracteres').max(100),
    new_password: z.string().min(8, 'Como mínimo 8 caracteres').max(100),
  }),
});

// Restablecer contraseña
export const resetPasswordSchema = z.object({
  body: z.object({
    new_password: z.string().min(8, 'Como mínimo 8 caracteres').max(100),
  }),
});

// Verificación 2FA
export const twoFactorSchema = z.object({
  body: z.object({
    code: z.string().length(6, 'El código debe tener 6 dígitos'),
  }),
});