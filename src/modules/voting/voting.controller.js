// src/modules/voting/voting.controller.js
// Capa HTTP del módulo de VOTACIÓN.

import * as votingService from './voting.service.js';
import asyncHandler from '../../shared/utils/asyncHandler.js';
import { sendSuccess } from '../../shared/utils/apiResponse.js';
import { HTTP_STATUS } from '../../constants/httpStatus.js';

const getActorId = (user) => user?.userId ?? user?.id ?? null;

/**
 * POST /voting/elections/:electionId/sessions
 * Inicia una sesión de votación para el elector autenticado.
 */
export const startVotingSession = asyncHandler(async (req, res) => {
  const result = await votingService.startVotingSession({
    electionId: req.params.electionId,
    actorId: getActorId(req.user),
    ip: req.ip,
    userAgent: req.get('user-agent'),
    votingToken: req.body?.votingToken,
  });

  return sendSuccess(
    res,
    result,
    result.message,
    undefined,
    HTTP_STATUS.CREATED
  );
});

/**
 * POST /voting/sessions/:sessionId/cast
 * Emite el voto del elector.
 */
export const castSecureVote = asyncHandler(async (req, res) => {
  const result = await votingService.castSecureVote({
    sessionId: req.params.sessionId,
    actorId: getActorId(req.user),
    encryptedPayload: req.body.encryptedPayload,
    payloadHash: req.body.payloadHash,
    selections: req.body.selections,
  });

  return sendSuccess(
    res,
    result,
    result.message,
    undefined,
    HTTP_STATUS.OK
  );
});

/**
 * GET /voting/sessions/:id
 * Consulta el estado de una sesión de votación.
 */
export const getVotingSession = asyncHandler(async (req, res) => {
  const session = await votingService.getVotingSession(
    req.params.id,
    getActorId(req.user)
  );

  return sendSuccess(res, session, 'Sesión de votación', undefined, HTTP_STATUS.OK);
});

export default {
  startVotingSession,
  castSecureVote,
  getVotingSession,
};
