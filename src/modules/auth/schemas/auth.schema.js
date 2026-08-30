import { z } from 'zod';

const EMAIL_INSTITUCIONAL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.(edu\.pe|edu)$/;

export const UserRoleEnum = z.enum([
  'STUDENT',
  'TEACHER',
  'ADMIN',
  'SUPERADMIN',
  'ELECTORAL_COMMISSION',
  'OBSERVER',
  'JURY',
]);

// Login
export const loginSchema = z.object({
  body: z.object({
    email: z.string().email('Email inválido').trim().toLowerCase(),
    password: z.string().min(1, 'La contraseña es obligatoria'),
  }),
});

// Registro Alineado con Constraints de Postgres
export const registerSchema = z.object({
  body: z
    .object({
      username: z
        .string()
        .min(3, 'Mínimo 3 caracteres')
        .max(50, 'Máximo 50 caracteres')
        .regex(/^[a-zA-Z0-9._-]+$/, 'El usuario solo admite letras, números, puntos y guiones')
        .trim(),
      email: z.string().email('Email inválido').trim().toLowerCase(),
      password: z
        .string()
        .min(8, 'Mínimo 8 caracteres')
        .regex(/[A-Z]/, 'Debe contener al menos una letra mayúscula')
        .regex(/[a-z]/, 'Debe contener al menos una letra minúscula')
        .regex(/\d/, 'Debe contener al menos un número'),
      firstName: z.string().min(1, 'El nombre es obligatorio').max(150).trim(),
      lastName: z.string().min(1, 'El apellido es obligatorio').max(150).trim(),
      institutionalId: z.string().min(1, 'El ID institucional es obligatorio').trim(),
      role: UserRoleEnum.default('STUDENT'),

      // Contexto Académico y Organizacional
      organizationId: z.string().uuid('UUID de organización inválido').optional(),
      facultyId: z.string().uuid('UUID de facultad inválido').optional(),
      programId: z.string().uuid('UUID de programa inválido').optional(),
      currentCycle: z.number().int().min(1).max(20).optional(),
      admissionPeriodId: z.string().uuid('UUID de periodo inválido').optional(),
      specialty: z.string().max(255).optional(),
      department: z.string().max(255).optional(),
    })
    .superRefine((data, ctx) => {
      // Regla: Validar correo institucional para Estudiantes y Docentes
      if (
        ['STUDENT', 'TEACHER'].includes(data.role) &&
        !EMAIL_INSTITUCIONAL_REGEX.test(data.email)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Estudiantes y docentes deben usar un correo institucional (.edu o .edu.pe)',
          path: ['email'],
        });
      }

      // Regla: chk_users_academic_linkage & chk_users_student_data para STUDENT
      // El contexto académico (carrera/programa, ciclo) se asigna/configura por el ADMIN
      // de la organización; el estudiante puede registrarse sin elegir ciclo.
      if (data.role === 'STUDENT') {
        if (!data.programId) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'El programa académico (programId) es obligatorio para estudiantes',
            path: ['programId'],
          });
        }
      }

      // Regla: chk_users_academic_linkage para TEACHER
      if (data.role === 'TEACHER' && !data.facultyId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'La facultad (facultyId) es obligatoria para docentes',
          path: ['facultyId'],
        });
      }
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

// Verificación de código de Google (login OAuth)
export const googleVerifySchema = z.object({
  body: z.object({
    code: z.string().min(1, 'El código de Google es obligatorio'),
  }),
});