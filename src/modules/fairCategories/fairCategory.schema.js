// src/modules/fairCategories/fairCategory.schema.js
// Validación (Zod) con envelope { params, query, body } que exige
// validate.middleware.js.

import { z } from 'zod';

const uuid = (label = 'ID') => z.string().uuid(`${label} debe ser un UUID válido`);

const nameField = z
  .string()
  .trim()
  .min(3, 'El nombre debe tener al menos 3 caracteres')
  .max(200, 'El nombre no puede superar los 200 caracteres');

const descriptionField = z
  .string()
  .trim()
  .max(5000, 'La descripción no puede superar los 5000 caracteres');

const fairParam = z.object({
  id: uuid('El ID de la feria'),
});

export const listCategoriesSchema = z.object({
  params: fairParam,
});

export const createCategorySchema = z.object({
  params: fairParam,
  body: z
    .object({
      name: nameField,
      description: descriptionField.optional(),
    })
    .strict(),
});

export const updateCategorySchema = z.object({
  params: z.object({
    id: uuid('El ID de la feria'),
    categoryId: uuid('El ID de la categoría'),
  }),
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

export const deleteCategorySchema = z.object({
  params: z.object({
    id: uuid('El ID de la feria'),
    categoryId: uuid('El ID de la categoría'),
  }),
});

export default {
  listCategoriesSchema,
  createCategorySchema,
  updateCategorySchema,
  deleteCategorySchema,
};