// src/modules/fairStands/fairStand.controller.js
import * as fairStandService from './fairStand.service.js';
import asyncHandler from '../../shared/utils/asyncHandler.js';
import {
  sendCreated,
  sendSuccess,
} from '../../shared/utils/apiResponse.js';
import { HTTP_STATUS } from '../../constants/httpStatus.js';

const getActorId = (user) => user?.userId ?? user?.id ?? null;

const getActor = (user) => ({
  id: getActorId(user) || user?.id,
  role: user?.role,
  organizationId: user?.organizationId || null,
  isSuperAdmin: user?.isSuperAdmin || false,
  isSuperuser: user?.isSuperuser || false,
});

// GET /api/fairs/:id/stands
export const listStands = asyncHandler(async (req, res) => {
  const result = await fairStandService.listStands({
    fairId: req.params.id,
    actor: getActor(req.user),
  });
  return sendSuccess(res, result, 'Stands obtenidos correctamente', {}, HTTP_STATUS.OK);
});

// POST /api/fairs/:id/stands
export const createStand = asyncHandler(async (req, res) => {
  const stand = await fairStandService.createStand({
    fairId: req.params.id,
    data: req.body,
    actor: getActor(req.user),
  });
  return sendCreated(res, stand, 'Stand creado correctamente');
});

// PUT /api/fairs/:id/stands/:standId
export const updateStand = asyncHandler(async (req, res) => {
  const stand = await fairStandService.updateStand({
    fairId: req.params.id,
    standId: req.params.standId,
    data: req.body,
    actor: getActor(req.user),
  });
  return sendSuccess(res, stand, 'Stand actualizado correctamente', {}, HTTP_STATUS.OK);
});

// DELETE /api/fairs/:id/stands/:standId
export const deleteStand = asyncHandler(async (req, res) => {
  const result = await fairStandService.deleteStand({
    fairId: req.params.id,
    standId: req.params.standId,
    actor: getActor(req.user),
  });
  return sendSuccess(res, result, 'Stand eliminado correctamente', {}, HTTP_STATUS.OK);
});

export default {
  listStands,
  createStand,
  updateStand,
  deleteStand,
};