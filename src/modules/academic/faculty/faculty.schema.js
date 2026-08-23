import { z } from 'zod';

// --- PARÁMETROS DE RUTA ---
export const idParamSchema = z.object({
  params: z.object({
    id: z.string().uuid('ID inválido (debe ser un UUID válido)'),
  }),
});

//  CREACIÓN (POST) 
export const createProgramSchema = z.object({
  body: z.object({
    faculty_id: z.string()
      .uuid('El faculty_id debe ser un UUID válido'),
    name: z.string()
      .trim()
      .min(3, 'El nombre debe tener al menos 3 caracteres')
      .max(150, 'El nombre no puede exceder los 150 caracteres'),
    code: z.string()
      .trim()
      .min(2, 'El código debe tener al menos 2 caracteres')
      .max(20, 'El código no puede exceder los 20 caracteres'),
  }).strict('No se permiten campos adicionales en la creación'),
});

// --- ACTUALIZACIÓN (PUT) ---
export const updateProgramSchema = z.object({
  params: z.object({
    id: z.string().uuid('ID inválido (debe ser un UUID válido)'),
  }),
  body: z.object({
    faculty_id: z.string()
      .uuid('El faculty_id debe ser un UUID válido')
      .optional(),
    name: z.string()
      .trim()
      .min(3, 'El nombre debe tener al menos 3 caracteres')
      .max(150, 'El nombre no puede exceder los 150 caracteres')
      .optional(),
    code: z.string()
      .trim()
      .min(2, 'El código debe tener al menos 2 caracteres')
      .max(20, 'El código no puede exceder los 20 caracteres')
      .optional(),
  })
  .strict('No se permiten campos adicionales en la actualización')
  .refine(
    (data) => data.faculty_id !== undefined || data.name !== undefined || data.code !== undefined,
    { message: 'Debes proporcionar al menos un campo (faculty_id, name o code) para actualizar' }
  ),
});