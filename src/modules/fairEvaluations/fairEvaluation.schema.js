// src/modules/fairEvaluations/fairEvaluation.schema.js
// Validación (Zod) con envelope { params, query, body } que exige
// validate.middleware.js. Dominio exclusivo de FERIAS (sin mezclar con
// ratings electorales).

import { z } from 'zod';

const uuid = (label = 'ID') => z.string().uuid(`${label} debe ser un UUID válido`);

const fairParam = z.object({
  id: uuid('El ID de la feria'),
});

const nameField = z
  .string()
  .trim()
  .min(1, 'El nombre no puede estar vacío')
  .max(200, 'El nombre no puede superar los 200 caracteres');

const descriptionField = z
  .string()
  .trim()
  .max(5000, 'La descripción no puede superar los 5000 caracteres');

const scoreField = z.coerce.number().finite('La puntuación debe ser un número válido');

const criterionBody = z
  .object({
    name: nameField,
    description: descriptionField.optional(),
    min_score: scoreField,
    max_score: scoreField,
    position: z.coerce.number().int().min(1).optional(),
  })
  .strict();

export const createRubricSchema = z.object({
  params: fairParam,
  body: z
    .object({
      name: nameField,
      description: descriptionField.optional(),
    })
    .strict(),
});

export const updateRubricSchema = z.object({
  params: fairParam,
  body: z
    .object({
      name: nameField.optional(),
      description: descriptionField.optional(),
    })
    .strict()
    .refine((data) => Object.values(data).some((value) => value !== undefined), {
      message: 'Debes proporcionar al menos un campo para actualizar',
    }),
});

export const getRubricSchema = z.object({
  params: fairParam,
});

export const addCriterionSchema = z.object({
  params: fairParam,
  body: criterionBody,
});

export const updateCriterionSchema = z.object({
  params: z.object({
    id: uuid('El ID de la feria'),
    criterionId: uuid('El ID del criterio'),
  }),
  body: z
    .object({
      name: nameField.optional(),
      description: descriptionField.optional(),
      min_score: scoreField.optional(),
      max_score: scoreField.optional(),
      position: z.coerce.number().int().min(1).optional(),
    })
    .strict()
    .refine((data) => Object.values(data).some((value) => value !== undefined), {
      message: 'Debes proporcionar al menos un campo para actualizar',
    }),
});

export const deleteCriterionSchema = z.object({
  params: z.object({
    id: uuid('El ID de la feria'),
    criterionId: uuid('El ID del criterio'),
  }),
});

const paginationQuery = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
};

export const listApprovedProjectsSchema = z.object({
  params: fairParam,
  query: z.object({
    ...paginationQuery,
    search: z.string().trim().min(1).max(200).optional(),
    category_id: uuid('El category_id').optional(),
    stand_id: uuid('El stand_id').optional(),
  }),
});

// GET /api/fairs/:id/projects/:projectId — detalle compartido (JURY asignado
// para revisar; ADMIN de la organización dueña para consultar desde resultados).
// Sin ProjectReview ni ProjectDetail: se deriva de Project + ProjectMember.
export const getProjectReviewSchema = z.object({
  params: z.object({
    id: uuid('El ID de la feria'),
    projectId: uuid('El ID del proyecto'),
  }),
});

export const listEvaluationsSchema = z.object({
  params: fairParam,
  query: z.object({
    ...paginationQuery,
    project_id: uuid('El project_id').optional(),
    jury_user_id: uuid('El jury_user_id').optional(),
  }),
});

export const createEvaluationSchema = z.object({
  params: fairParam,
  body: z
    .object({
      project_id: uuid('El project_id'),
      comment: z.string().trim().max(5000, 'El comentario no puede superar los 5000 caracteres').optional(),
      scores: z
        .array(
          z
            .object({
              criterion_id: uuid('El criterion_id'),
              score: scoreField,
            })
            .strict()
        )
        .min(1, 'Debes enviar al menos una puntuación'),
    })
    .strict(),
});

export const updateEvaluationSchema = z.object({
  params: z.object({
    id: uuid('El ID de la feria'),
    evaluationId: uuid('El ID de la evaluación'),
  }),
  body: z
    .object({
      comment: z.string().trim().max(5000, 'El comentario no puede superar los 5000 caracteres').optional(),
      scores: z
        .array(
          z
            .object({
              criterion_id: uuid('El criterion_id'),
              score: scoreField,
            })
            .strict()
        )
        .min(1, 'Debes enviar al menos una puntuación')
        .optional(),
    })
    .strict()
    .refine((data) => Object.values(data).some((value) => value !== undefined), {
      message: 'Debes proporcionar al menos un campo para actualizar',
    }),
});

export const myEvaluationsSchema = z.object({
  query: z.object({
    ...paginationQuery,
    fair_id: uuid('El fair_id').optional(),
  }),
});

// ── Declaración de jurado (JURY; feria DRAFT u OPEN) ───────────────

export const declarationGetSchema = z.object({
  params: fairParam,
});

export const createDeclarationSchema = z.object({
  params: fairParam,
  body: z
    .object({
      statement: z
        .string()
        .trim()
        .min(1, 'La declaración no puede estar vacía')
        .max(2000, 'La declaración no puede superar los 2000 caracteres'),
    })
    .strict(),
});

// ── Mi avance (JURY) ────────────────────────────────────────────────

export const myProgressSchema = z.object({
  params: z.object({
    fairId: uuid('El ID de la feria'),
  }),
});

export default {
  createRubricSchema,
  updateRubricSchema,
  getRubricSchema,
  addCriterionSchema,
  updateCriterionSchema,
  deleteCriterionSchema,
  listApprovedProjectsSchema,
  getProjectReviewSchema,
  listEvaluationsSchema,
  createEvaluationSchema,
  updateEvaluationSchema,
  myEvaluationsSchema,
  declarationGetSchema,
  createDeclarationSchema,
  myProgressSchema,
};