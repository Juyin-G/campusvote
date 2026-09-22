// src/modules/academic/teachingEvaluation/evaluationResponse.schema.js
// Schemas Zod para las evaluaciones docentes del estudiante.
// Solo valida formato de entrada. Las reglas de negocio están en el Service.

import { z } from 'zod';

// ============================================================
// CAMPOS COMPARTIDOS
// ============================================================

const uuidField = z.string().uuid('Debe ser un UUID válido');

const responseIdField = z
  .string()
  .uuid('El responseId debe ser un UUID válido');

const commentField = z
  .string()
  .trim()
  .max(2000, 'El comentario no puede exceder los 2000 caracteres')
  .optional();

// ============================================================
// CREAR DRAFT
// ============================================================

export const createDraftSchema = z.object({
  body: z.object({
    teachingAssignmentId: uuidField,
  }),
});

// ============================================================
// OBTENER / ELIMINAR EVALUACIÓN (parámetro :responseId)
// ============================================================

export const responseIdParamSchema = z.object({
  params: z.object({
    responseId: responseIdField,
  }),
});

// ============================================================
// ACTUALIZAR COMENTARIO
// ============================================================

export const updateCommentSchema = z.object({
  params: z.object({
    responseId: responseIdField,
  }),
  body: z.object({
    comment: z
      .string()
      .trim()
      .max(2000, 'El comentario no puede exceder los 2000 caracteres')
      .nullable()
      .optional(),
  }),
});

// ============================================================
// ENVIAR EVALUACIÓN (solo responseId, sin body)
// ============================================================

export const submitResponseSchema = z.object({
  params: z.object({
    responseId: responseIdField,
  }),
});
