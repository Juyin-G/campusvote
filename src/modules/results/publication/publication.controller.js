// src/modules/results/publication/publication.controller.js
// S7-04 — Capa HTTP de publicación.

import * as publicationService from './publication.service.js';
import asyncHandler from '../../../shared/utils/asyncHandler.js';
import { sendSuccess } from '../../../shared/utils/apiResponse.js';
import MESSAGES from '../../../constants/messages.js';

/**
 * POST /api/elections/:id/publish
 */
export const publishElection = asyncHandler(async (req, res) => {
  const { id: electionId } = req.params;

  const result = await publicationService.publishElection(
    electionId,
    req.user,
    req.ip
  );

  return sendSuccess(
    res,
    result,
    MESSAGES.RESULTS.PUBLISHED_SUCCESS
  );
});

export default {
  publishElection,
};
