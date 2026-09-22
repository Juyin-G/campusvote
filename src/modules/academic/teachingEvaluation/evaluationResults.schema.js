import { z } from 'zod';

const uuidField = z.string().uuid('Debe ser un UUID válido');

export const teacherResultsParamsSchema = z.object({
  params: z.object({
    teacherId: uuidField,
  }),
});

export const teacherResultsQuerySchema = z.object({
  params: z.object({
    teacherId: uuidField,
  }),
  query: z.object({
    academicPeriodId: uuidField.optional(),
    courseId: uuidField.optional(),
  }),
});
