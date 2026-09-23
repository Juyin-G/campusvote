// src/modules/publicRegistration/publicRegistration.schema.js
// Validación (Zod) de la página pública de inscripción, con el envelope
// { params, query, body } que exige validate.middleware.js.

import { z } from 'zod';

// El token del enlace es base64url: no debe aceptar rutas ni comodines.
const publicTokenParam = z.object({
  token: z
    .string()
    .trim()
    .min(16, 'Enlace inválido')
    .max(64, 'Enlace inválido')
    .regex(/^[A-Za-z0-9_-]+$/, 'Enlace inválido'),
});

const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .email('Escribe un correo válido')
  .max(255, 'El correo es demasiado largo');

const nameField = z
  .string()
  .trim()
  .min(3, 'El nombre del proyecto debe tener al menos 3 caracteres')
  .max(200, 'El nombre del proyecto no puede superar los 200 caracteres');

const descriptionField = z
  .string()
  .trim()
  .max(5000, 'La descripción no puede superar los 5000 caracteres');

const optionalUuid = (label) =>
  z
    .union([z.literal(''), z.null(), z.string().uuid(`${label} debe ser un UUID válido`)])
    .transform((v) => v || null);

const optionalUrl = z
  .union([z.literal(''), z.null(), z.string().url('El enlace del proyecto no es válido').max(500)])
  .transform((v) => v || null);

// Correos de los integrantes: compañeros de equipo y, si lo hay, el asesor.
const membersField = z
  .array(emailField)
  .max(12, 'Puedes registrar hasta 12 integrantes')
  .default([]);

export const tokenParamSchema = z.object({
  params: publicTokenParam,
});

export const requestCodeSchema = z.object({
  params: publicTokenParam,
  body: z.object({ email: emailField }).strict(),
});

export const redeemCodeSchema = z.object({
  params: publicTokenParam,
  body: z
    .object({
      email: emailField,
      code: z
        .string()
        .trim()
        .regex(/^\d{6}$/, 'El código son 6 dígitos'),
    })
    .strict(),
});

export const createProjectSchema = z.object({
  params: publicTokenParam,
  body: z
    .object({
      name: nameField,
      description: descriptionField.optional(),
      category_id: optionalUuid('La categoría').optional(),
      project_url: optionalUrl.optional(),
      members: membersField.optional(),
    })
    .strict(),
});

export const updateProjectSchema = z.object({
  params: publicTokenParam,
  body: z
    .object({
      name: nameField.optional(),
      description: descriptionField.optional(),
      category_id: optionalUuid('La categoría').optional(),
      project_url: optionalUrl.optional(),
      members: membersField.optional(),
    })
    .strict()
    .refine((data) => Object.values(data).some((value) => value !== undefined), {
      message: 'Debes proporcionar al menos un campo para actualizar',
    }),
});

export default {
  tokenParamSchema,
  requestCodeSchema,
  redeemCodeSchema,
  createProjectSchema,
  updateProjectSchema,
};
