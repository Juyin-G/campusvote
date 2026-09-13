// src/modules/organizations/organizationSite/organizationSite.schema.js
// Validación (Zod) con envelope { params, query, body } que exige
// validate.middleware.js.

import { z } from 'zod';

const uuid = (label = 'ID') => z.string().uuid(`${label} debe ser un UUID válido`);

const nameField = z
  .string()
  .trim()
  .min(3, 'El nombre debe tener al menos 3 caracteres')
  .max(200, 'El nombre no puede superar los 200 caracteres');

const addressField = z
  .string()
  .trim()
  .max(500, 'La dirección no puede superar los 500 caracteres');

const cityField = z
  .string()
  .trim()
  .max(100, 'La ciudad no puede superar los 100 caracteres');

// Coordenada opcional: número en rango, o ''/null para limpiarla.
const nullableCoord = (min, max, label) =>
  z
    .union([z.literal(''), z.null(), z.coerce.number().min(min).max(max)])
    .transform((value) => (value === '' || value === null ? null : value));

const latitudeField = nullableCoord(-90, 90, 'La latitud');
const longitudeField = nullableCoord(-180, 180, 'La longitud');

export const siteIdParamSchema = z.object({
  params: z.object({
    siteId: uuid('El site_id'),
  }),
});

export const listSitesSchema = z.object({
  params: z.object({}),
});

export const createSiteSchema = z.object({
  body: z
    .object({
      name: nameField,
      address: addressField.optional(),
      city: cityField.optional(),
      latitude: latitudeField.optional(),
      longitude: longitudeField.optional(),
    })
    .strict(),
});

export const updateSiteSchema = z.object({
  params: siteIdParamSchema.shape.params,
  body: z
    .object({
      name: nameField.optional(),
      address: addressField.optional(),
      city: cityField.optional(),
      latitude: latitudeField.optional(),
      longitude: longitudeField.optional(),
    })
    .strict()
    .refine((data) => Object.values(data).some((value) => value !== undefined), {
      message: 'Debes proporcionar al menos un campo para actualizar',
    }),
});

export default {
  siteIdParamSchema,
  listSitesSchema,
  createSiteSchema,
  updateSiteSchema,
};