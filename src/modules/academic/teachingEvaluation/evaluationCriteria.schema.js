// src/modules/academic/teachingEvaluation/evaluationCriteria.schema.js
// Schemas Zod para la administración de criterios de evaluación docente.
// Solo valida formato de entrada. Las reglas de negocio están en el Service.

import { z } from 'zod';

// ============================================================
// CAMPOS COMPARTIDOS
// ============================================================

const criterionIdField = z
  .string()
  .uuid('El criterionId debe ser un UUID válido');

const nameField = z
  .string()
  .trim()
  .min(3, 'El nombre debe tener al menos 3 caracteres')
  .max(255, 'El nombre no puede exceder los 255 caracteres');

const descriptionField = z
  .string()
  .trim()
  .max(2000, 'La descripción no puede exceder los 2000 caracteres')
  .optional();

// ============================================================
// CREAR CRITERIO
// ============================================================

export const createCriterionSchema = z.object({
  body: z.object({
    name: nameField,
    description: descriptionField,
  }),
});

// ============================================================
// ACTUALIZAR CRITERIO
// ============================================================

export const updateCriterionSchema = z.object({
  params: z.object({
    criterionId: criterionIdField,
  }),
  body: z
    .object({
      name: nameField.optional(),
      description: z
        .string()
        .trim()
        .max(2000, 'La descripción no puede exceder los 2000 caracteres')
        .nullable()
        .optional(),
    })
    .refine((data) => data.name !== undefined || data.description !== undefined, {
      message: 'Debes proporcionar al menos un campo (name o description) para actualizar',
    }),
});

// ============================================================
// TOGGLE / ELIMINAR / OBTENER CRITERIO (parámetro :criterionId)
// ============================================================

export const criterionIdParamSchema = z.object({
  params: z.object({
    criterionId: criterionIdField,
  }),
});
