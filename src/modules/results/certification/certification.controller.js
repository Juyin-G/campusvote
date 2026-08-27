// src/modules/results/certification/certification.controller.js
// Capa HTTP de certificación.
//
// Responsabilidades:
//   - Recibir electionId desde params.
//   - Llamar al Service.
//   - Devolver respuestas estandarizadas.
//
// NO accede a Prisma.
// NO contiene reglas de negocio.

import * as certificationService from './certification.service.js';
import asyncHandler from '../../../shared/utils/asyncHandler.js';
import { sendSuccess } from '../../../shared/utils/apiResponse.js';
import MESSAGES from '../../../constants/messages.js';

/**
 * POST /api/elections/:id/certify
 * (La ruta exacta se monta en FASE 8.)
 */
export const certifyElection = asyncHandler(async (req, res) => {
  const { id: electionId } = req.params;

  const result = await certificationService.certifyElection(
    electionId,
    req.user,
    req.ip
  );

  return sendSuccess(
    res,
    result,
    MESSAGES.RESULTS.CALCULATED_SUCCESS
  );
});

export default {
  certifyElection,
};
