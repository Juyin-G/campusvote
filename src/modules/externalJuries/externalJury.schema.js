// src/modules/externalJuries/externalJury.schema.js
// Validación Zod de las rutas de jurados externos.

import { z } from 'zod';

const uuid = z.string().uuid('ID inválido');

export const inviteExternalJurySchema = z.object({
  body: z
    .object({
      fair_id: uuid,
      email: z.string().email('Email inválido').max(254),
      full_name: z.string().min(1, 'Como mínimo 1 carácter').max(200, 'Máximo 200 caracteres'),
      document_type: z.enum(['DNI', 'CE']).optional(),
      document_number: z
        .string()
        .trim()
        .max(20, 'Máximo 20 caracteres')
        .optional()
        .or(z.literal('')),
    })
    .refine(
      (d) => {
        const hasType = Boolean(d.document_type);
        const hasNumber = Boolean(d.document_number);
        return hasType === hasNumber;
      },
      { message: 'document_type y document_number deben enviarse juntos', path: ['document_type'] }
    ),
});

export const listExternalJuriesSchema = z.object({
  query: z.object({
    fair_id: uuid.optional(),
  }),
});

export const inviteParamsSchema = z.object({
  params: z.object({
    inviteId: uuid,
  }),
});