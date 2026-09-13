// src/modules/fairResults/fairResult.controller.js
import * as fairResultService from './fairResult.service.js';
import asyncHandler from '../../shared/utils/asyncHandler.js';
import { sendSuccess } from '../../shared/utils/apiResponse.js';
import { HTTP_STATUS } from '../../constants/httpStatus.js';

const getActorId = (user) => user?.userId ?? user?.id ?? null;

const getActor = (user) => ({
  id: getActorId(user) || user?.id,
  role: user?.role,
  organizationId: user?.organizationId || null,
  isSuperAdmin: user?.isSuperAdmin || false,
  isSuperuser: user?.isSuperuser || false,
});

// GET /api/fairs/:id/results
export const getFairResults = asyncHandler(async (req, res) => {
  const result = await fairResultService.getFairResults({
    fairId: req.params.id,
    actor: getActor(req.user),
  });
  return sendSuccess(res, result, 'Resultados de la feria obtenidos correctamente', {}, HTTP_STATUS.OK);
});

// POST /api/fairs/:id/results/publish
export const publishFairResults = asyncHandler(async (req, res) => {
  const result = await fairResultService.publishFairResults({
    fairId: req.params.id,
    actor: getActor(req.user),
  });
  return sendCreated(res, result, 'Resultados publicados correctamente');
});

export default {
  getFairResults,
  publishFairResults,
};