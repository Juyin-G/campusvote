// src/modules/fairs/fair.controller.js
import * as fairService from './fair.service.js';
import asyncHandler from '../../shared/utils/asyncHandler.js';
import {
  sendCreated,
  sendSuccess,
  sendPaginated,
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

// GET /api/fairs
export const listFairs = asyncHandler(async (req, res) => {
  const result = await fairService.listFairs({
    actor: getActor(req.user),
    filters: req.query,
  });
  return sendPaginated(res, result.data, result.pagination, 'Ferias obtenidas correctamente');
});

// GET /api/fairs/:id
export const getFairById = asyncHandler(async (req, res) => {
  const fair = await fairService.getFairById({
    fairId: req.params.id,
    actor: getActor(req.user),
  });
  return sendSuccess(res, fair, 'Feria obtenida correctamente', {}, HTTP_STATUS.OK);
});

// POST /api/fairs
export const createFair = asyncHandler(async (req, res) => {
  const fair = await fairService.createFair({
    data: req.body,
    actor: getActor(req.user),
  });
  return sendCreated(res, fair, 'Feria creada correctamente');
});

// PUT /api/fairs/:id
export const updateFair = asyncHandler(async (req, res) => {
  const fair = await fairService.updateFair({
    fairId: req.params.id,
    data: req.body,
    actor: getActor(req.user),
  });
  return sendSuccess(res, fair, 'Feria actualizada correctamente', {}, HTTP_STATUS.OK);
});

// POST /api/fairs/:id/status
export const changeFairStatus = asyncHandler(async (req, res) => {
  const fair = await fairService.changeFairStatus({
    fairId: req.params.id,
    data: req.body,
    actor: getActor(req.user),
  });
  return sendSuccess(res, fair, 'Estado de la feria actualizado correctamente', {}, HTTP_STATUS.OK);
});

export default {
  listFairs,
  getFairById,
  createFair,
  updateFair,
  changeFairStatus,
};