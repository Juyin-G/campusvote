// src/modules/projects/project.schema.js
// Validación (Zod) con envelope { params, query, body } que exige
// validate.middleware.js.

import { z } from 'zod';

const uuid = (label = 'ID') => z.string().uuid(`${label} debe ser un UUID válido`);

const nameField = z
  .string()
  .trim()
  .min(3, 'El nombre debe tener al menos 3 caracteres')
  .max(200, 'El nombre no puede superar los 200 caracteres');

const urlField = (label) =>
  z
    .string()
    .trim()
    .url(`${label} debe ser una URL válida`)
    .max(1000, `${label} no puede superar los 1000 caracteres`);

const descriptionField = z
  .string()
  .trim()
  .max(5000, 'La descripción no puede superar los 5000 caracteres');

const projectStatusEnum = z.enum(['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED']);
const memberRoleEnum = z.enum(['EXPOSITOR', 'COLLABORATOR', 'ADVISOR']);

// Categoría de la feria; null la quita.
const categoryField = z.union([uuid('El category_id'), z.null()]);

export const idParamSchema = z.object({
  params: z.object({
    id: uuid('El ID del proyecto'),
  }),
});

export const listProjectsQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    status: projectStatusEnum.optional(),
    fair_id: uuid('El fair_id').optional(),
    search: z.string().trim().min(1).max(200).optional(),
  }),
});

export const createProjectSchema = z.object({
  body: z
    .object({
      fair_id: uuid('El fair_id'),
      category_id: uuid('El category_id').optional(),
      name: nameField,
      description: descriptionField.optional(),
      logo_url: urlField('El logo').optional(),
      cover_url: urlField('La portada').optional(),
      project_url: urlField('La URL del proyecto').optional(),
      category_id: uuid('La categoría').optional(),
    })
    .strict(),
});

export const updateProjectSchema = z.object({
  params: idParamSchema.shape.params,
  body: z
    .object({
      fair_id: uuid('El fair_id').optional(),
      category_id: categoryField.optional(),
      name: nameField.optional(),
      description: descriptionField.optional(),
      logo_url: urlField('El logo').optional(),
      cover_url: urlField('La portada').optional(),
      project_url: urlField('La URL del proyecto').optional(),
      category_id: uuid('La categoría').nullable().optional(),
    })
    .strict()
    .refine((data) => Object.values(data).some((value) => value !== undefined), {
      message: 'Debes proporcionar al menos un campo para actualizar',
    }),
});

export const reviewProjectSchema = z.object({
  params: idParamSchema.shape.params,
  body: z
    .object({
      decision: z.enum(['APPROVED', 'REJECTED']),
      review_notes: z
        .string()
        .trim()
        .max(2000, 'Las observaciones no pueden superar los 2000 caracteres')
        .optional(),
      // Al revisar la inscripción, el admin puede corregir la categoría.
      category_id: categoryField.optional(),
    })
    .strict(),
});

export const addMemberSchema = z.object({
  params: idParamSchema.shape.params,
  body: z
    .object({
      // El docente agrega a sus alumnos por correo institucional; user_id se
      // mantiene para clientes que ya conocen el ID.
      email: z.string().trim().toLowerCase().email('Email inválido').optional(),
      user_id: uuid('El user_id').optional(),
      role: memberRoleEnum.default('EXPOSITOR'),
    })
    .strict()
    .refine((data) => Boolean(data.email) !== Boolean(data.user_id), {
      message: 'Indica el correo institucional (email) o el user_id del integrante, no ambos',
    }),
});

export const assignStandSchema = z.object({
  params: idParamSchema.shape.params,
  body: z
    .object({
      // null libera el stand del proyecto.
      stand_id: z.union([uuid('El stand_id'), z.null()]),
    })
    .strict(),
});

export const memberParamSchema = z.object({
  params: z.object({
    id: uuid('El ID del proyecto'),
    userId: uuid('El ID del usuario'),
  }),
});

export default {
  idParamSchema,
  listProjectsQuerySchema,
  createProjectSchema,
  updateProjectSchema,
  reviewProjectSchema,
  addMemberSchema,
  assignStandSchema,
  memberParamSchema,
};
