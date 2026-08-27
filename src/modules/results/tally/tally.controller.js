// src/modules/results/tally/tally.controller.js
// S7-01 — Capa HTTP de tallies.
//
// Responsabilidades:
//   - Recibir parámetros HTTP.
//   - Llamar al Service.
//   - Devolver respuestas estandarizadas con apiResponse.
//   - Capturar errores vía asyncHandler.
//
// NO accede a Prisma.
// NO contiene lógica de conteo.
// NO contiene reglas de negocio.

import * as tallyService from './tally.service.js';
import asyncHandler from '../../../shared/utils/asyncHandler.js';
import { sendSuccess } from '../../../shared/utils/apiResponse.js';
import MESSAGES from '../../../constants/messages.js';

// ─────────────────────────────────────────────────────────────
// HANDLERS
// ─────────────────────────────────────────────────────────────

/**
 * POST /api/results/:electionId/tally/recalculate
 * (La ruta exacta se monta en FASE 8.)
 */
export const recalculateTallies = asyncHandler(async (req, res) => {
  const { electionId } = req.params;
  const result = await tallyService.recalculateTallies(electionId);

  return sendSuccess(
    res,
    result,
    MESSAGES.RESULTS.CALCULATED_SUCCESS
  );
});

/**
 * GET /api/results/:electionId/tally
 * Devuelve los tallies ya almacenados.
 */
export const getTallies = asyncHandler(async (req, res) => {
  const { electionId } = req.params;
  const tallies = await tallyService.getExistingTallies(electionId);

  return sendSuccess(
    res,
    tallies,
    'Conteo de votos de la elección'
  );
});

// ─────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────

export default {
  recalculateTallies,
  getTallies,
};
