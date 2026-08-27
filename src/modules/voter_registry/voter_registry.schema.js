// src/modules/voter_registry/voter_registry.schema.js

import { z } from 'zod';

// ENUMS (Alineados con PostgreSQL y Prisma)

export const VoterClaimTypeEnum = z.enum([
  'MISSING_FROM_REGISTRY',
  'INCORRECT_DATA',
  'INELIGIBLE_MARKED_ELIGIBLE',
]);

export const VoterClaimStatusEnum = z.enum([
  'PENDING',
  'APPROVED',
  'REJECTED',
]);

// SCHEMAS DE RECLAMOS DE PADRÓN (voter_registry_claims)


// Creación de Reclamo (Payload del Estudiante/Usuario)
export const createVoterClaimSchema = z.object({
  body: z.object({
    periodId: z.string().uuid({
      message: 'El periodId debe ser un UUID válido.',
    }),
    claimType: VoterClaimTypeEnum,
    description: z
      .string()
      .trim()
      .min(10, { message: 'La descripción debe tener al menos 10 caracteres.' })
      .max(2000, { message: 'La descripción no puede superar los 2000 caracteres.' }),
    supportingDocumentUrl: z
      .string()
      .url({ message: 'La URL del documento adjunto debe ser una URL válida.' })
      .nullable()
      .optional(),
  }),
});

// Resolución de Reclamo (Payload del Revisor / Electoral Commission)
export const resolveVoterClaimSchema = z.object({
  params: z.object({
    claimId: z.string().uuid({
      message: 'El claimId debe ser un UUID válido.',
    }),
  }),
  body: z.object({
    status: z.enum(['APPROVED', 'REJECTED'], {
      errorMap: () => ({
        message: 'El estado de resolución debe ser APPROVED o REJECTED.',
      }),
    }),
    resolutionNotes: z
      .string()
      .trim()
      .max(1000, { message: 'Las notas de resolución no pueden superar los 1000 caracteres.' })
      .nullable()
      .optional(),
  }),
});

// Parámetros de consulta para listar reclamos (Paginación y Filtros)
export const queryVoterClaimsSchema = z.object({
  query: z.object({
    periodId: z.string().uuid().optional(),
    status: VoterClaimStatusEnum.optional(),
    claimType: VoterClaimTypeEnum.optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
});

// SCHEMAS DEL PADRÓN ELECTORAL (voter_registries)


// Consulta pública / verificación de inclusión en padrón
export const checkVoterRegistrySchema = z.object({
  query: z.object({
    periodId: z.string().uuid({
      message: 'El periodId es requerido y debe ser un UUID válido.',
    }),
  }),
});

// Modificación manual o anulación de elegibilidad en padrón
export const updateVoterEligibilitySchema = z.object({
  params: z.object({
    registryId: z.string().uuid({
      message: 'El registryId debe ser un UUID válido.',
    }),
  }),
  body: z.object({
    isEligible: z.boolean({
      required_error: 'El campo isEligible es requerido.',
    }),
    eligibilityReason: z
      .string()
      .trim()
      .min(3, { message: 'La razón debe tener al menos 3 caracteres.' })
      .max(255, { message: 'La razón no puede superar los 255 caracteres.' }),
  }),
});