// src/modules/academic/voter-registry/voter-registry.schema.js

import { z } from 'zod';

// 1. PARAMETROS DE RUTA (ID)
export const voterRegistryIdParamSchema = z.object({
  id: z.string().uuid({ message: 'El ID del registro debe ser un UUID válido.' }),
});

// 2. SINCRONIZACIÓN DESDE SIS (Procedimiento Almacenado)
export const syncSisVotersSchema = z.object({
  periodId: z.string().uuid({ message: 'El periodId debe ser un UUID válido.' }),
  students: z
    .array(
      z.object({
        institutional_id: z.string().trim().min(1, 'El ID institucional es requerido.'),
        program_id: z.string().uuid({ message: 'El program_id debe ser un UUID válido.' }),
        cycle: z.number().int().min(1).max(14, 'El ciclo debe estar entre 1 y 14.'),
      })
    )
    .min(1, 'El array de estudiantes no puede estar vacío.'),
});

// 3. REGISTRO MANUAL DE VOTANTE
export const createVoterRegistrySchema = z.object({
  userId: z.string().uuid({ message: 'El userId debe ser un UUID válido.' }),
  programId: z.string().uuid({ message: 'El programId debe ser un UUID válido.' }),
  periodId: z.string().uuid({ message: 'El periodId debe ser un UUID válido.' }),
  semester: z.number().int().min(1).max(14, 'El semestre/ciclo debe estar entre 1 y 14.'),
  isEligible: z.boolean().default(true),
  eligibilityReason: z.string().trim().nullable().optional(),
});

// 4. ACTUALIZACIÓN DE ESTADO O HABILITACIÓN DE VOTANTE
export const updateVoterRegistrySchema = z.object({
  programId: z.string().uuid({ message: 'El programId debe ser un UUID válido.' }).optional(),
  semester: z.number().int().min(1).max(14).optional(),
  isEligible: z.boolean().optional(),
  eligibilityReason: z.string().trim().min(3, 'El motivo de inhabilitación/reclamo debe tener al menos 3 caracteres.').optional(),
});

// 5. FILTROS Y PAGINACIÓN PARA LISTADOS
export const getVoterRegistriesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  periodId: z.string().uuid().optional(),
  programId: z.string().uuid().optional(),
  isEligible: z.enum(['true', 'false']).transform((val) => val === 'true').optional(),
  search: z.string().trim().optional(), 
});