// src/modules/PlatformTranslation/PlatformTranslation.schema.js

import { z } from 'zod';

const uuid = (label) => z.string().uuid(`${label} inválido`);

// chk_translations_key_format: ^[a-z0-9._-]+$
const translationKey = z
  .string()
  .max(150, 'La clave de traducción no puede exceder 150 caracteres')
  .regex(
    /^[a-z0-9._-]+$/,
    'La clave solo puede contener letras minúsculas, números, puntos, guiones y guiones bajos'
  );

// category: VARCHAR(50)
const category = z
  .string()
  .max(50, 'La categoría no puede exceder 50 caracteres')
  .default('general');

// values: JSONB no vacío (objeto con claves de locale y valores de texto)
const translationValues = z
  .record(z.string(), z.string(), {
    invalid_type_error: 'Las traducciones deben ser un objeto con claves y valores de texto',
  })
  .refine(
    (val) => Object.keys(val).length > 0,
    'El objeto de traducciones no puede estar vacío'
  );

/**
 * POST /api/platform/translations
 */
export const createPlatformTranslationSchema = z.object({
  body: z.object({
    translation_key: translationKey,
    category: category.optional(),
    values: translationValues,
  }),
});

/**
 * PATCH /api/platform/translations/:id
 */
export const updatePlatformTranslationSchema = z.object({
  params: z.object({
    id: uuid('ID de traducción'),
  }),
  body: z
    .object({
      translation_key: translationKey.optional(),
      category: category.optional(),
      values: translationValues.optional(),
    })
    .refine(
      (data) => Object.keys(data).length > 0,
      'Al menos un campo debe ser proporcionado para actualizar'
    ),
});

/**
 * GET /api/platform/translations/dictionary
 * Para consumir la función SQL get_ui_translations
 */
export const getDictionarySchema = z.object({
  query: z.object({
    locale: z.string().max(10).optional().default('es-PE'),
    category: z.string().max(50).optional(),
  }),
});

/**
 * GET /api/platform/translations/effective-locale/:userId
 * Para consumir la función SQL get_effective_locale
 */
export const getEffectiveLocaleSchema = z.object({
  params: z.object({
    userId: uuid('ID de usuario'),
  }),
});