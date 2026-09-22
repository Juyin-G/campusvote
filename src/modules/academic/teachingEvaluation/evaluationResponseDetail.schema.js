// src/modules/academic/teachingEvaluation/evaluationResponseDetail.schema.js
// Schemas Zod para los detalles de evaluación (score por criterio).
// Solo valida formato de entrada. Las reglas de negocio están en el Service.

import { z } from 'zod';

// ============================================================
// CAMPOS COMPARTIDOS
// ============================================================

const responseIdField = z
  .string()
  .uuid('El responseId debe ser un UUID válido');

const criterionIdField = z
  .string()
  .uuid('El criterionId debe ser un UUID válido');

const scoreField = z
  .number()
  .int('El score debe ser un número entero')
  .min(1, 'El score mínimo es 1')
  .max(5, 'El score máximo es 5');

// ============================================================
// UPsert DETAIL (crear/actualizar)
// ============================================================

export const upsertDetailSchema = z.object({
  params: z.object({
    responseId: responseIdField,
    criterionId: criterionIdField,
  }),
  body: z.object({
    score: scoreField,
  }),
});

// ============================================================
// ELIMINAR DETAIL
// ============================================================

export const deleteDetailSchema = z.object({
  params: z.object({
    responseId: responseIdField,
    criterionId: criterionIdField,
  }),
});

// ============================================================
// LISTAR DETALLES
// ============================================================

export const getDetailsSchema = z.object({
  params: z.object({
    responseId: responseIdField,
  }),
});
