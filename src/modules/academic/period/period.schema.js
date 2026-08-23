import { z } from 'zod';

// --- PARÁMETROS DE RUTA ---
export const idParamSchema = z.object({
  params: z.object({
    id: z.string().uuid('ID inválido (debe ser un UUID válido)'),
  }),
});

// --- CREACIÓN (POST) ---
export const createPeriodSchema = z.object({
  body: z.object({
    name: z.string()
      .trim()
      .min(3, 'El nombre debe tener al menos 3 caracteres')
      .max(50, 'El nombre no puede exceder los 50 caracteres'),
    
    start_date: z.string().date('Formato de fecha inválido (debe ser YYYY-MM-DD)'),
    end_date: z.string().date('Formato de fecha inválido (debe ser YYYY-MM-DD)'),
    is_active: z.boolean().optional().default(false),
  })
  .strict('No se permiten campos adicionales')
  .refine((data) => data.start_date < data.end_date, {
    message: 'La fecha de inicio debe ser estrictamente anterior a la fecha de fin',
    path: ['end_date'],
  }),
});

// --- ACTUALIZACIÓN (PUT) ---
export const updatePeriodSchema = z.object({
  params: z.object({
    id: z.string().uuid('ID inválido (debe ser un UUID válido)'),
  }),
  body: z.object({
    name: z.string()
      .trim()
      .min(3, 'El nombre debe tener al menos 3 caracteres')
      .max(50, 'El nombre no puede exceder los 50 caracteres')
      .optional(),
    start_date: z.string().date('Formato de fecha inválido (debe ser YYYY-MM-DD)').optional(),
    end_date: z.string().date('Formato de fecha inválido (debe ser YYYY-MM-DD)').optional(),
    is_active: z.boolean().optional(),
  })
  .strict('No se permiten campos adicionales')
  .refine(
    (data) => data.name !== undefined || data.start_date !== undefined || data.end_date !== undefined || data.is_active !== undefined,
    { message: 'Debes proporcionar al menos un campo para actualizar' }
  )
  .refine(
    (data) => {
      if (data.start_date && data.end_date) {
        return data.start_date < data.end_date;
      }
      return true;
    },
    {
      message: 'La fecha de inicio debe ser estrictamente anterior a la fecha de fin',
      path: ['end_date'],
    }
  ),
});