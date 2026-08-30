import { z } from 'zod';
import { passwordSchema } from '../../shared/utils/passwordPolicy.js';
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
    password: passwordSchema,
    first_name: z.string().min(1, 'Como mínimo 1 carácter').max(50),
    last_name: z.string().min(1, 'Como mínimo 1 carácter').max(50),
    institutional_id: z.string().min(1, 'Como mínimo 1 carácter').max(50),
    role: roleEnum,
    organization_id: z.string().uuid('ID inválido').optional(),
    program_id: z.string().uuid('ID inválido').optional(),
    faculty_id: z.string().uuid('ID inválido').optional(),
    current_cycle: z.number().int().min(1, 'Como mínimo 1').max(20, 'Como máximo 20').optional(),
  })
  .superRefine((data, ctx) => {
    const addIssue = (field, message) =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [field], message });
    if (data.role === 'STUDENT') {
      if (!data.program_id) addIssue('program_id', 'Un estudiante requiere program_id');
      if (!data.current_cycle) addIssue('current_cycle', 'Un estudiante requiere current_cycle');
    } else if (data.role === 'TEACHER' && !data.faculty_id) {
      addIssue('faculty_id', 'Un docente requiere faculty_id');
    }
  }),
});

const profileBodySchema = z
  .object({
    first_name: z.string().min(1, 'Como mínimo 1 carácter').max(50).optional(),
    last_name: z.string().min(1, 'Como mínimo 1 carácter').max(50).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Al menos un campo debe ser proporcionado',
  });

// Actualizar perfil propio (PUT /me)
export const updateMeSchema = z.object({
  body: profileBodySchema,
});

// Actualizar usuario por ID (PUT /:id) — solo campos que el service persiste
export const updateUserSchema = z.object({
  params: z.object({
    id: z.string().uuid('ID inválido'),
  }),
  body: z
    .object({
      first_name: z.string().min(1, 'Como mínimo 1 carácter').max(50).optional(),
      last_name: z.string().min(1, 'Como mínimo 1 carácter').max(50).optional(),
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
    new_password: passwordSchema,
  }),
});

// Restablecer contraseña
export const resetPasswordSchema = z.object({
  body: z.object({
    new_password: passwordSchema,
  }),
});

// Verificación 2FA
export const twoFactorSchema = z.object({
  body: z.object({
    code: z.string().length(6, 'El código debe tener 6 dígitos'),
  }),
});