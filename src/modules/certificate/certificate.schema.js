// src/modules/certificate/certificate.schema.js
// Validación (Zod) con envelope { params, query, body }.
// El cliente SOLO puede indicar el id de la feria o del certificado.
// NO puede enviar fair_id / project_id / user_id / certificate_type
// para saltarse las reglas de generación: esos valores los determina el
// backend a partir del estado oficial de la BD.

import { z } from 'zod';

const uuid = (label = 'ID') => z.string().uuid(`${label} debe ser un UUID válido`);

export const generateCertificatesSchema = z.object({
  params: z.object({
    id: uuid('El ID de la feria'),
  }),
});

export const certificateIdParamSchema = z.object({
  params: z.object({
    certificateId: uuid('El ID del certificado'),
  }),
});

export default {
  generateCertificatesSchema,
  certificateIdParamSchema,
};