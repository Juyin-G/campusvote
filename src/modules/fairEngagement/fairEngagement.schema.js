// src/modules/fairEngagement/fairEngagement.schema.js
// Validación (Zod) con envelope { params, query, body }.

import { z } from 'zod';

const uuid = (label = 'ID') => z.string().uuid(`${label} debe ser un UUID válido`);

const fairParam = z.object({ fairId: uuid('El ID de la feria') });

const projectInFairParams = z.object({
  fairId: uuid('El ID de la feria'),
  projectId: uuid('El ID del proyecto'),
});

const commentParam = z.object({
  fairId: uuid('El ID de la feria'),
  commentId: uuid('El ID del comentario'),
});

const isAnonymousField = z
  .preprocess((v) => (typeof v === 'boolean' ? v : v !== 'false' && v !== false), z.boolean())
  .optional();

export const likeSchema = z.object({ params: projectInFairParams });
export const unlikeSchema = z.object({ params: projectInFairParams });
export const likeStatusSchema = z.object({ params: projectInFairParams });

export const createCommentSchema = z.object({
  params: projectInFairParams,
  body: z
    .object({
      comment: z.string().min(1, 'El comentario no puede estar vacío'),
      is_anonymous: isAnonymousField,
    })
    .strict(),
});

export const listCommentsSchema = z.object({ params: projectInFairParams });

export const updateCommentSchema = z.object({
  params: commentParam,
  body: z
    .object({
      comment: z.string().min(1, 'El comentario no puede estar vacío'),
      is_anonymous: isAnonymousField,
    })
    .strict(),
});

export const deleteCommentSchema = z.object({ params: commentParam });

export default {
  likeSchema,
  unlikeSchema,
  likeStatusSchema,
  createCommentSchema,
  listCommentsSchema,
  updateCommentSchema,
  deleteCommentSchema,
};
