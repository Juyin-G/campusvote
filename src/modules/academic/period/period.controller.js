import * as periodService from './period.service.js';
import asyncHandler from '../../../shared/utils/asyncHandler.js';
import { sendSuccess } from '../../../shared/utils/apiResponse.js';
import { HTTP_STATUS } from '../../../constants/httpStatus.js';

// Los períodos son de cada institución: el actor define qué se ve y qué se crea.
const getActor = (user) => ({
  id: user?.userId ?? user?.id ?? null,
  role: user?.role,
  organizationId: user?.organizationId || null,
});

export const getPeriods = asyncHandler(async (req, res) => {
  const { data, meta } = await periodService.listPeriods(req.query, getActor(req.user));
  return sendSuccess(res, data, 'Periodos obtenidos exitosamente', meta, HTTP_STATUS.OK);
});

export const getPeriodById = asyncHandler(async (req, res) => {
  const period = await periodService.getPeriodById(req.params.id, getActor(req.user));
  return sendSuccess(res, period, 'Periodo obtenido exitosamente', undefined, HTTP_STATUS.OK);
});

export const createPeriod = asyncHandler(async (req, res) => {
  const period = await periodService.createPeriod(req.body, getActor(req.user));
  return sendSuccess(res, period, 'Periodo creado exitosamente', undefined, HTTP_STATUS.CREATED);
});

export const updatePeriod = asyncHandler(async (req, res) => {
  const period = await periodService.updatePeriod(req.params.id, req.body, getActor(req.user));
  return sendSuccess(res, period, 'Periodo actualizado exitosamente', undefined, HTTP_STATUS.OK);
});

export const setActivePeriod = asyncHandler(async (req, res) => {
  const period = await periodService.setActivePeriod(req.params.id, getActor(req.user));
  return sendSuccess(res, period, 'Periodo marcado como activo exitosamente', undefined, HTTP_STATUS.OK);
});

export const deletePeriod = asyncHandler(async (req, res) => {
  await periodService.deletePeriod(req.params.id, getActor(req.user));
  return sendSuccess(res, null, 'Periodo eliminado exitosamente', undefined, HTTP_STATUS.OK);
});