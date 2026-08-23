import * as periodService from './period.service.js';
import asyncHandler from '../../../shared/utils/asyncHandler.js';
import { sendSuccess } from '../../../shared/utils/apiResponse.js';
import { HTTP_STATUS } from '../../../constants/httpStatus.js';

export const getPeriods = asyncHandler(async (req, res) => {
  const periods = await periodService.listPeriods(req.query);
  return sendSuccess(res, periods, 'Periodos obtenidos exitosamente', undefined, HTTP_STATUS.OK);
});

export const getPeriodById = asyncHandler(async (req, res) => {
  const period = await periodService.getPeriodById(req.params.id);
  return sendSuccess(res, period, 'Periodo obtenido exitosamente', undefined, HTTP_STATUS.OK);
});

export const createPeriod = asyncHandler(async (req, res) => {
  const period = await periodService.createPeriod(req.body);
  return sendSuccess(res, period, 'Periodo creado exitosamente', undefined, HTTP_STATUS.CREATED);
});

export const updatePeriod = asyncHandler(async (req, res) => {
  const period = await periodService.updatePeriod(req.params.id, req.body);
  return sendSuccess(res, period, 'Periodo actualizado exitosamente', undefined, HTTP_STATUS.OK);
});

export const setActivePeriod = asyncHandler(async (req, res) => {
  const period = await periodService.setActivePeriod(req.params.id);
  return sendSuccess(res, period, 'Periodo marcado como activo', undefined, HTTP_STATUS.OK);
});

export const deletePeriod = asyncHandler(async (req, res) => {
  await periodService.deletePeriod(req.params.id);
  return sendSuccess(res, null, 'Periodo eliminado exitosamente', undefined, HTTP_STATUS.OK);
});

