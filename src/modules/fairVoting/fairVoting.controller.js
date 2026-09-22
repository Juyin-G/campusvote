// src/modules/fairVoting/fairVoting.controller.js
// Capa HTTP del módulo de VOTACIÓN ANÓNIMA de FERIAS.

import * as votingService from './fairVoting.service.js';
import * as resultsService from './fairVoting.results.service.js';
import asyncHandler from '../../shared/utils/asyncHandler.js';
import { sendSuccess, sendCreated, sendPaginated } from '../../shared/utils/apiResponse.js';
import { HTTP_STATUS } from '../../constants/httpStatus.js';

const getActorId = (user) => user?.userId ?? user?.id ?? null;
const getActor = (user) => ({
  id: getActorId(user) || user?.id,
  role: user?.role,
  organizationId: user?.organizationId || null,
});

// POST /api/fairs/:fairId/votes
export const castVote = asyncHandler(async (req, res) =>
  sendCreated(res, await votingService.castVote({ fairId: req.params.fairId, data: req.body, actor: getActor(req.user) }), 'Voto registrado correctamente')
);

// GET /api/fairs/:fairId/voting/status
export const getVotingStatus = asyncHandler(async (req, res) =>
  sendSuccess(res, await votingService.getVotingStatus({ fairId: req.params.fairId, actor: getActor(req.user) }), 'Estado de votación obtenido correctamente', {}, HTTP_STATUS.OK)
);

// GET /api/fairs/:fairId/voting/results (ADMIN)
export const getVotingResults = asyncHandler(async (req, res) =>
  sendSuccess(
    res,
    await resultsService.getVotingResults({ fairId: req.params.fairId, actor: getActor(req.user) }),
    'Resultados de votación obtenidos correctamente (agrupados por categoría)',
    {},
    HTTP_STATUS.OK
  )
);

// GET /api/fairs/:fairId/voting/verify/:receiptCode (público)
export const verifyReceipt = asyncHandler(async (req, res) =>
  sendSuccess(res, await resultsService.verifyReceipt({ fairId: req.params.fairId, receiptCode: req.params.receiptCode }), 'Verificación de comprobante', {}, HTTP_STATUS.OK)
);

export default {
  castVote,
  getVotingStatus,
  getVotingResults,
  verifyReceipt,
};
