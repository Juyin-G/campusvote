// src/modules/results/results.controller.js
// S7-05 — Capa HTTP de resultados en vivo y finales.

import * as resultsService from './results.service.js';
import asyncHandler from '../../shared/utils/asyncHandler.js';
import { sendSuccess } from '../../shared/utils/apiResponse.js';

/**
 * GET /api/results/live?election_id=...
 * (También accesible por /api/elections/:electionId/results/live)
 */
export const getLiveResults = asyncHandler(async (req, res) => {
  const electionId = req.params.electionId || req.query.election_id;
  const data = await resultsService.getLiveResults(electionId);
  return sendSuccess(res, data, 'Resultados en vivo');
});

/**
 * GET /api/results/final?election_id=...
 */
export const getFinalResults = asyncHandler(async (req, res) => {
  const electionId = req.params.electionId || req.query.election_id;
  const data = await resultsService.getFinalResults(electionId);
  return sendSuccess(res, data, 'Resultados finales');
});

export default {
  getLiveResults,
  getFinalResults,
};
