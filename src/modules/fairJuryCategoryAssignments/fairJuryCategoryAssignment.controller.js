// src/modules/fairJuryCategoryAssignments/fairJuryCategoryAssignment.controller.js
import * as service from './fairJuryCategoryAssignment.service.js';
import asyncHandler from '../../shared/utils/asyncHandler.js';
import { sendCreated, sendSuccess } from '../../shared/utils/apiResponse.js';
import { HTTP_STATUS } from '../../constants/httpStatus.js';

const getActorId = (user) => user?.userId ?? user?.id ?? null;

const getActor = (user) => ({
  id: getActorId(user) || user?.id,
  role: user?.role,
  organizationId: user?.organizationId || null,
  isSuperAdmin: user?.isSuperAdmin || false,
  isSuperuser: user?.isSuperuser || false,
});

// GET /api/fairs/:id/juries/:userId/categories
export const listCategories = asyncHandler(async (req, res) => {
  const result = await service.listByUser({
    fairId: req.params.id,
    userId: req.params.userId,
    actor: getActor(req.user),
  });
  return sendSuccess(res, result, 'Categorías del jurado obtenidas correctamente', {}, HTTP_STATUS.OK);
});

// POST /api/fairs/:id/juries/:userId/categories
export const assignCategory = asyncHandler(async (req, res) => {
  const result = await service.assignCategory({
    fairId: req.params.id,
    userId: req.params.userId,
    categoryId: req.body.category_id,
    actor: getActor(req.user),
  });
  return sendCreated(res, result, 'Categoría asignada al jurado correctamente');
});

// DELETE /api/fairs/:id/juries/:userId/categories/:categoryId
export const removeCategory = asyncHandler(async (req, res) => {
  const result = await service.removeCategory({
    fairId: req.params.id,
    userId: req.params.userId,
    categoryId: req.params.categoryId,
    actor: getActor(req.user),
  });
  return sendSuccess(res, result, 'Categoría removida del jurado correctamente', {}, HTTP_STATUS.OK);
});

export default {
  listCategories,
  assignCategory,
  removeCategory,
};
