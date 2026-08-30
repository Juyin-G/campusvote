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
// chk_users_institutional_email: estudiantes y docentes necesitan correo .edu/.edu.pe
const EMAIL_INSTITUCIONAL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.(edu\.pe|edu)$/;

export const createUserSchema = z.object({
  body: z
    .object({
      username: z.string().min(3, 'Como mínimo 3 caracteres').max(50),
      email: z.string().email('Email inválido'),
      password: passwordSchema,
      first_name: z.string().min(1, 'Como mínimo 1 carácter').max(50),
      last_name: z.string().min(1, 'Como mínimo 1 carácter').max(50),
      institutional_id: z.string().min(1, 'Como mínimo 1 carácter').max(50),
      role: roleEnum,
      organization_id: z.string().uuid('ID inválido').optional(),

      // Vínculo académico. Lo exige la base de datos según el rol; sin estos
      // campos el alta terminaba en 500 en lugar de en un 400 explicativo.
      faculty_id: z.string().uuid('ID de facultad inválido').optional(),
      program_id: z.string().uuid('ID de programa inválido').optional(),
      current_cycle: z.coerce.number().int().min(1).max(20).optional(),
    })
    .superRefine((data, ctx) => {
      const err = (path, message) =>
        ctx.addIssue({ code: 'custom', path: [path], message });

      // chk_users_institutional_email
      if (
        ['STUDENT', 'TEACHER'].includes(data.role) &&
        !EMAIL_INSTITUCIONAL_REGEX.test(data.email)
      ) {
        err(
          'email',
          'Estudiantes y docentes deben usar un correo institucional (.edu o .edu.pe)'
        );
      }

      // chk_users_academic_linkage y chk_users_student_data
      if (data.role === 'STUDENT') {
        if (!data.program_id) {
          err('program_id', 'El programa académico es obligatorio para estudiantes');
        }
        if (data.current_cycle === undefined || data.current_cycle === null) {
          err('current_cycle', 'El ciclo actual es obligatorio para estudiantes');
        }
      } else if (data.current_cycle !== undefined) {
        // chk_users_student_data exige current_cycle NULL si no es estudiante
        err('current_cycle', 'El ciclo actual solo aplica a estudiantes');
      }

      // chk_users_academic_linkage
      if (data.role === 'TEACHER' && !data.faculty_id) {
        err('faculty_id', 'La facultad es obligatoria para docentes');
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