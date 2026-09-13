// src/modules/fairResults/fairResult.schema.js
// Validación (Zod) con envelope { params, query, body } que exige
// validate.middleware.js. El endpoint de resultados SOLO admite el id de la
// feria como parámetro de ruta: el cliente no puede indicar fair_id alternativo,
// rubric_id, criterion_id, average_score, ranking ni winner — todo eso se
// deriva del backend a partir de las evaluaciones en BD.

import { z } from 'zod';

const uuid = (label = 'ID') => z.string().uuid(`${label} debe ser un UUID válido`);

export const getFairResultsSchema = z.object({
  params: z.object({
    id: uuid('El ID de la feria'),
  }),
});

// POST /api/fairs/:id/results/publish — SOLO admite el id de la feria en la
// ruta. El cliente NO envía ranking/winner/proyecto ganador: el backend vuelve
// a derivar el ranking desde las evaluaciones al persistir la publicación.
export const publishFairResultsSchema = z.object({
  params: z.object({
    id: uuid('El ID de la feria'),
  }),
});

export default {
  getFairResultsSchema,
  publishFairResultsSchema,
};