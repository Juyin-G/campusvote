import { z } from 'zod';

export const createCareerSchema = z.object({
  body: z.object({
    code: z.string().min(1, 'Como mínimo 1 carácter').max(20),
    name: z.string().min(1, 'Como mínimo 1 carácter').max(150),
    total_cycles: z.coerce.number().int().min(1).max(20).optional(),
  }),
});

export const updateCareerSchema = z.object({
  params: z.object({ id: z.string().uuid('ID inválido') }),
  body: z.object({
    code: z.string().min(1).max(20).optional(),
    name: z.string().min(1).max(150).optional(),
    total_cycles: z.coerce.number().int().min(1).max(20).optional(),
    is_active: z.boolean().optional(),
  }).refine((data) => Object.keys(data).length > 0, {
    message: 'Al menos un campo debe ser proporcionado',
  }),
});

export const idParamSchema = z.object({
  params: z.object({ id: z.string().uuid('ID inválido') }),
});
