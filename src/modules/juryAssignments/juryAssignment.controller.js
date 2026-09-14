// src/modules/juryAssignments/juryAssignment.controller.js
import * as juryService from './juryAssignment.service.js';
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

// GET /api/fairs/:id/juries
export const listJuries = asyncHandler(async (req, res) => {
  const result = await juryService.listJuries({
    fairId: req.params.id,
    actor: getActor(req.user),
  });
  return sendSuccess(res, result, 'Jurados obtenidos correctamente', {}, HTTP_STATUS.OK);
});

// POST /api/fairs/:id/juries
export const assignJury = asyncHandler(async (req, res) => {
  const assignment = await juryService.assignJury({
    fairId: req.params.id,
    userId: req.body.user_id,
    actor: getActor(req.user),
  });
  return sendCreated(res, assignment, 'Jurado asignado correctamente');
});

// GET /api/fairs/:id/juries/:userId
export const getJuryAssignment = asyncHandler(async (req, res) => {
  const assignment = await juryService.getJuryAssignment({
    fairId: req.params.id,
    userId: req.params.userId,
    actor: getActor(req.user),
  });
  return sendSuccess(res, assignment, 'Asignación obtenida correctamente', {}, HTTP_STATUS.OK);
});

// DELETE /api/fairs/:id/juries/:userId
export const removeJury = asyncHandler(async (req, res) => {
  const result = await juryService.removeJury({
    fairId: req.params.id,
    userId: req.params.userId,
    actor: getActor(req.user),
  });
  return sendSuccess(res, result, 'Jurado removido correctamente', {}, HTTP_STATUS.OK);
});

// GET /api/fairs/my-assignments
export const listMyAssignments = asyncHandler(async (req, res) => {
  const result = await juryService.listMyAssignments({
    actor: getActor(req.user),
    filters: req.query,
  });
  return sendPaginated(res, result.data, result.pagination, 'Ferias asignadas obtenidas correctamente');
});

// GET /api/fairs/my-assignments/:fairId
export const getMyAssignmentFair = asyncHandler(async (req, res) => {
  const result = await juryService.getMyAssignmentFair({
    fairId: req.params.fairId,
    actor: getActor(req.user),
  });
  return sendSuccess(res, result, 'Feria asignada obtenida correctamente', {}, HTTP_STATUS.OK);
});

export default {
  listJuries,
  assignJury,
  getJuryAssignment,
  removeJury,
  listMyAssignments,
  getMyAssignmentFair,
};