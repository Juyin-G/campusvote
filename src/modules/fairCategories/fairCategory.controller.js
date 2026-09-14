// src/modules/fairCategories/fairCategory.controller.js
import * as fairCategoryService from './fairCategory.service.js';
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

// GET /api/fairs/:id/categories
export const listCategories = asyncHandler(async (req, res) => {
  const result = await fairCategoryService.listCategories({
    fairId: req.params.id,
    actor: getActor(req.user),
  });
  return sendSuccess(res, result, 'Categorías obtenidas correctamente', {}, HTTP_STATUS.OK);
});

// POST /api/fairs/:id/categories
export const createCategory = asyncHandler(async (req, res) => {
  const category = await fairCategoryService.createCategory({
    fairId: req.params.id,
    data: req.body,
    actor: getActor(req.user),
  });
  return sendCreated(res, category, 'Categoría creada correctamente');
});

// PUT /api/fairs/:id/categories/:categoryId
export const updateCategory = asyncHandler(async (req, res) => {
  const category = await fairCategoryService.updateCategory({
    fairId: req.params.id,
    categoryId: req.params.categoryId,
    data: req.body,
    actor: getActor(req.user),
  });
  return sendSuccess(res, category, 'Categoría actualizada correctamente', {}, HTTP_STATUS.OK);
});

// DELETE /api/fairs/:id/categories/:categoryId
export const deleteCategory = asyncHandler(async (req, res) => {
  const result = await fairCategoryService.deleteCategory({
    fairId: req.params.id,
    categoryId: req.params.categoryId,
    actor: getActor(req.user),
  });
  return sendSuccess(res, result, 'Categoría eliminada correctamente', {}, HTTP_STATUS.OK);
});

export default {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
};