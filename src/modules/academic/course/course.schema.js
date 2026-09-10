import { z } from 'zod';

export const createCourseSchema = z.object({
  body: z.object({
    code: z.string().min(1, 'Como mínimo 1 carácter').max(30),
    name: z.string().min(1, 'Como mínimo 1 carácter').max(150),
    cycle: z.number().int().min(1).max(20),
    careerId: z.string().uuid('ID de carrera inválido'),
  }),
});

export const updateCourseSchema = z.object({
  params: z.object({ id: z.string().uuid('ID inválido') }),
  body: z.object({
    code: z.string().min(1).max(30).optional(),
    name: z.string().min(1).max(150).optional(),
    cycle: z.number().int().min(1).max(20).optional(),
    careerId: z.string().uuid('ID de carrera inválido').optional(),
    isActive: z.boolean().optional(),
  }).refine((data) => Object.keys(data).length > 0, {
    message: 'Al menos un campo debe ser proporcionado',
  }),
});

export const idParamSchema = z.object({
  params: z.object({ id: z.string().uuid('ID inválido') }),
});
