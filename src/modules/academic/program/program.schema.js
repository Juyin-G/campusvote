import { z } from 'zod';

// 1. Campos base reutilizables
const facultyIdField = z.string().uuid('El faculty_id debe ser un UUID válido');

const nameField = z.string()
  .trim()
  .min(3, 'El nombre debe tener al menos 3 caracteres')
  .max(150, 'El nombre no puede exceder los 150 caracteres (VARCHAR 150)');

const codeField = z.string()
  .trim()
  .min(2, 'El código debe tener al menos 2 caracteres')
  .max(20, 'El código no puede exceder los 20 caracteres (VARCHAR 20)');

// 2. Validación de parámetro :id en URL
export const idParamSchema = z.object({
  params: z.object({
    id: z.string().uuid('ID inválido (debe ser un UUID válido)'),
  }),
});

// 3. Esquema de Creación (POST)
export const createProgramSchema = z.object({
  body: z.object({
    faculty_id: facultyIdField,
    name: nameField,
    code: codeField,
  }),
});

// 4. Esquema de Actualización (PUT / PATCH)
export const updateProgramSchema = z.object({
  params: idParamSchema.shape.params, 
  body: z.object({
    faculty_id: facultyIdField.optional(),
    name: nameField.optional(),
    code: codeField.optional(),
  }).refine(
    (data) => Object.values(data).some((value) => value !== undefined),
    {
      message: 'Debes proporcionar al menos un campo (faculty_id, name o code) para actualizar',
    }
  ),
});