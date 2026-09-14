// src/modules/organizations/organizationSite/organizationSite.controller.js
import * as siteService from './organizationSite.service.js';
import asyncHandler from '../../../shared/utils/asyncHandler.js';
import {
  sendCreated,
  sendSuccess,
} from '../../../shared/utils/apiResponse.js';
import { HTTP_STATUS } from '../../../constants/httpStatus.js';

const getActorId = (user) => user?.userId ?? user?.id ?? null;

const getActor = (user) => ({
  id: getActorId(user) || user?.id,
  role: user?.role,
  organizationId: user?.organizationId || null,
  isSuperAdmin: user?.isSuperAdmin || false,
  isSuperuser: user?.isSuperuser || false,
});

// GET /api/organizations/sites
export const listSites = asyncHandler(async (req, res) => {
  const result = await siteService.listSites({ actor: getActor(req.user) });
  return sendSuccess(res, result, 'Sedes obtenidas correctamente', {}, HTTP_STATUS.OK);
});

// GET /api/organizations/sites/:siteId
export const getSiteById = asyncHandler(async (req, res) => {
  const site = await siteService.getSiteById({
    siteId: req.params.siteId,
    actor: getActor(req.user),
  });
  return sendSuccess(res, site, 'Sede obtenida correctamente', {}, HTTP_STATUS.OK);
});

// POST /api/organizations/sites
export const createSite = asyncHandler(async (req, res) => {
  const site = await siteService.createSite({
    data: req.body,
    actor: getActor(req.user),
  });
  return sendCreated(res, site, 'Sede creada correctamente');
});

// PUT /api/organizations/sites/:siteId
export const updateSite = asyncHandler(async (req, res) => {
  const site = await siteService.updateSite({
    siteId: req.params.siteId,
    data: req.body,
    actor: getActor(req.user),
  });
  return sendSuccess(res, site, 'Sede actualizada correctamente', {}, HTTP_STATUS.OK);
});

// DELETE /api/organizations/sites/:siteId
export const deleteSite = asyncHandler(async (req, res) => {
  const result = await siteService.deleteSite({
    siteId: req.params.siteId,
    actor: getActor(req.user),
  });
  return sendSuccess(res, result, 'Sede eliminada correctamente', {}, HTTP_STATUS.OK);
});

export default {
  listSites,
  getSiteById,
  createSite,
  updateSite,
  deleteSite,
};