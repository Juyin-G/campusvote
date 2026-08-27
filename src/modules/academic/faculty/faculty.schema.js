import { z } from 'zod';

// --- PARÁMETROS DE RUTA ---
export const idParamSchema = z.object({
  params: z.object({
    id: z.string().uuid('ID de facultad inválido (debe ser un UUID válido)'),
  }),
});

// --- CREACIÓN (POST) ---
export const createFacultySchema = z.object({
  body: z.object({
    name: z.string()
      .trim()
      .min(3, 'El nombre de la facultad debe tener al menos 3 caracteres')
      .max(150, 'El nombre de la facultad no puede exceder los 150 caracteres'),
    code: z.string()
      .trim()
      .min(2, 'El código de la facultad debe tener al menos 2 caracteres')
      .max(20, 'El código de la facultad no puede exceder los 20 caracteres'),
  }).strict('No se permiten campos adicionales en la creación'),
});

// --- ACTUALIZACIÓN (PUT / PATCH) ---
export const updateFacultySchema = z.object({
  params: z.object({
    id: z.string().uuid('ID de facultad inválido (debe ser un UUID válido)'),
  }),
  body: z.object({
    name: z.string()
      .trim()
      .min(3, 'El nombre de la facultad debe tener al menos 3 caracteres')
      .max(150, 'El nombre de la facultad no puede exceder los 150 caracteres')
      .optional(),
    code: z.string()
      .trim()
      .min(2, 'El código de la facultad debe tener al menos 2 caracteres')
      .max(20, 'El código de la facultad no puede exceder los 20 caracteres')
      .optional(),
  })
  .strict('No se permiten campos adicionales en la actualización')
  .refine(
    (data) => data.name !== undefined || data.code !== undefined,
    { message: 'Debes proporcionar al menos un campo (name o code) para actualizar' }
  ),
});