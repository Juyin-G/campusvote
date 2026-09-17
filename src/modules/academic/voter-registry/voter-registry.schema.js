// src/modules/academic/voter-registry/voter-registry.schema.js
// Schemas Zod con "envelope" { params | query | body } exigido por
// `validate.middleware.js`, que siempre parsea ({ body, query, params }).

import { z } from 'zod';

const uuid = (label = 'ID') => z.string().uuid(`${label} debe ser un UUID válido`);

// 1. PARÁMETROS DE RUTA (ID)
export const voterRegistryIdParamSchema = z.object({
  params: z.object({
    id: uuid('El ID del registro'),
  }),
});

// 2. SINCRONIZACIÓN DESDE SIS (Procedimiento Almacenado)
export const syncSisVotersSchema = z.object({
  body: z.object({
    periodId: uuid('El periodId'),
    students: z
      .array(
        z.object({
          institutional_id: z.string().trim().min(1, 'El ID institucional es requerido.'),
          program_id: uuid('El program_id'),
          cycle: z.number().int().min(1).max(20, 'El ciclo debe estar entre 1 y 20.'),
        })
      )
      .min(1, 'El array de estudiantes no puede estar vacío.'),
  }),
});

// 3. REGISTRO MANUAL DE VOTANTE
export const createVoterRegistrySchema = z.object({
  body: z.object({
    userId: uuid('El userId'),
    programId: uuid('El programId'),
    periodId: uuid('El periodId'),
    semester: z.number().int().min(1).max(20, 'El semestre/ciclo debe estar entre 1 y 20.'),
    isEligible: z.boolean().default(true),
    eligibilityReason: z.string().trim().nullable().optional(),
  }),
});

// 4. ACTUALIZACIÓN DE ESTADO O HABILITACIÓN DE VOTANTE
export const updateVoterRegistrySchema = z.object({
  body: z.object({
    programId: uuid('El programId').optional(),
    semester: z.number().int().min(1).max(20).optional(),
    isEligible: z.boolean().optional(),
    eligibilityReason: z.string().trim().min(3, 'El motivo debe tener al menos 3 caracteres.').optional(),
  }),
});

// 5. FILTROS Y PAGINACIÓN PARA LISTADOS
export const getVoterRegistriesQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
    periodId: z.string().uuid().optional(),
    programId: z.string().uuid().optional(),
    isEligible: z.enum(['true', 'false']).transform((val) => val === 'true').optional(),
    search: z.string().trim().optional(),
  }),
});
